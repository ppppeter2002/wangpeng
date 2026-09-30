import prisma from './prisma.js'
import { getWechatServiceStatus, sendWechatTemplateMessage, type WechatTemplateMessage } from './wechat-official.js'

type NotificationRecord = {
  id: string
  userId: string
  type: string
  title: string
  content: string
  payload: string | null
  read: boolean
  channel: string
  deliveryStatus: string
  deliveryError: string | null
  externalMessageId: string | null
  deliveredAt: Date | null
  createdAt: Date
}

type NotificationPayloadObject = {
  wechatTemplate?: WechatTemplateMessage
  wechatOpenId?: string
  [key: string]: unknown
}

type CreateNotificationInput = {
  userId: string
  type: string
  title: string
  content: string
  payload?: Record<string, unknown> | string | null
  channel?: string
}

function serializePayload(payload?: Record<string, unknown> | string | null): string | null {
  if (payload === undefined || payload === null) {
    return null
  }
  if (typeof payload === 'string') {
    return payload
  }
  return JSON.stringify(payload)
}

function parsePayload(payload: string | null): NotificationPayloadObject {
  if (!payload) {
    return {}
  }
  try {
    const parsed = JSON.parse(payload) as NotificationPayloadObject
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function resolveWechatTemplate(record: NotificationRecord): WechatTemplateMessage | null {
  const payload = parsePayload(record.payload)
  const template = payload.wechatTemplate
  if (!template) {
    return null
  }

  return {
    ...template,
    touser: template.touser || payload.wechatOpenId || undefined,
    miniprogram: template.miniprogram?.pagepath
      ? {
          appid: template.miniprogram.appid || process.env.WX_APPID || undefined,
          pagepath: template.miniprogram.pagepath
        }
      : undefined
  }
}

async function updateDeliveryStatus(notificationId: string, data: {
  deliveryStatus: string
  deliveryError?: string | null
  externalMessageId?: string | null
  deliveredAt?: Date | null
}) {
  const notificationModel = prisma.notification
  if (!notificationModel) {
    return
  }

  await notificationModel.update({
    where: { id: notificationId },
    data
  })
}

export async function attemptWechatNotificationDelivery(record: NotificationRecord): Promise<NotificationRecord> {
  const template = resolveWechatTemplate(record)
  const status = getWechatServiceStatus()

  if (!status.readyForTemplateSend) {
    await updateDeliveryStatus(record.id, {
      deliveryStatus: 'pending_config',
      deliveryError: 'WECHAT_SERVICE_CONFIG_MISSING',
      externalMessageId: null,
      deliveredAt: null
    })
  } else if (!template) {
    await updateDeliveryStatus(record.id, {
      deliveryStatus: 'pending_template',
      deliveryError: 'WECHAT_TEMPLATE_PAYLOAD_MISSING',
      externalMessageId: null,
      deliveredAt: null
    })
  } else if (!template.touser) {
    await updateDeliveryStatus(record.id, {
      deliveryStatus: 'pending_openid',
      deliveryError: 'WECHAT_TEMPLATE_TOUSER_MISSING',
      externalMessageId: null,
      deliveredAt: null
    })
  } else if (!template.templateId) {
    await updateDeliveryStatus(record.id, {
      deliveryStatus: 'pending_template_id',
      deliveryError: 'WECHAT_TEMPLATE_ID_MISSING',
      externalMessageId: null,
      deliveredAt: null
    })
  } else {
    try {
      const sent = await sendWechatTemplateMessage(template)
      await updateDeliveryStatus(record.id, {
        deliveryStatus: 'sent',
        deliveryError: null,
        externalMessageId: sent.msgId,
        deliveredAt: new Date()
      })
    } catch (error) {
      await updateDeliveryStatus(record.id, {
        deliveryStatus: 'failed',
        deliveryError: error instanceof Error ? error.message : 'WECHAT_TEMPLATE_UNKNOWN_ERROR',
        externalMessageId: null,
        deliveredAt: null
      })
    }
  }

  const notificationModel = prisma.notification
  if (!notificationModel) {
    return record
  }
  const refreshed = await notificationModel.findUnique({ where: { id: record.id } }) as NotificationRecord | null
  return refreshed ?? record
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
  const notificationModel = prisma.notification
  if (!notificationModel) {
    throw new Error('NOTIFICATION_MODEL_UNAVAILABLE')
  }

  const record = await notificationModel.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      content: input.content,
      payload: serializePayload(input.payload),
      read: false,
      channel: input.channel ?? 'wechat',
      deliveryStatus: 'queued',
      deliveryError: null,
      externalMessageId: null,
      deliveredAt: null
    }
  }) as NotificationRecord

  const delivered = await attemptWechatNotificationDelivery(record)
  console.log(`[wechat-notify] to=${input.userId} type=${input.type} notificationId=${record.id} status=${delivered.deliveryStatus}`)
  return delivered
}
