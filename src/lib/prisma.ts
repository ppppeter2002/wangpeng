import { PrismaClient } from '@prisma/client'

type PrismaLike = PrismaClient & {
  planSession?: {
    create(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown[]>
    findUnique(args: unknown): Promise<unknown | null>
  }
  report?: {
    create(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown[]>
  }
  inviteLink?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    update(args: unknown): Promise<unknown>
  }
  classSubject?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findFirst(args: unknown): Promise<unknown | null>
  }
  classSubjectChallenge?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findFirst(args: unknown): Promise<unknown | null>
    update(args: unknown): Promise<unknown>
  }
  commissionWallet?: {
    findUnique(args: unknown): Promise<unknown | null>
    upsert(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
  commissionTxn?: {
    create(args: unknown): Promise<unknown>
    findFirst(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
  }
  commissionSpend?: {
    create(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown[]>
  }
  lessonPlan?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    update(args: unknown): Promise<unknown>
  }
  lessonPlanRevision?: {
    create(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown[]>
  }
  lessonPlanInteraction?: {
    create(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown[]>
    update(args: unknown): Promise<unknown>
  }
  lessonPlanMarket?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    update(args: unknown): Promise<unknown>
  }
  lessonPlanPurchase?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
  }
  district?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findFirst(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
  }
  districtSpace?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findFirst(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    update(args: unknown): Promise<unknown>
  }
  districtSpaceMember?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findFirst(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    update(args: unknown): Promise<unknown>
    delete(args: unknown): Promise<unknown>
  }
  hotRecommendation?: {
    create(args: unknown): Promise<unknown>
    upsert(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown[]>
    deleteMany(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
  studentParent?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    delete(args: unknown): Promise<unknown>
    deleteMany(args: unknown): Promise<unknown>
  }
  studentClass?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    delete(args: unknown): Promise<unknown>
  }
  notification?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    update(args: unknown): Promise<unknown>
    updateMany(args: unknown): Promise<unknown>
    count(args: unknown): Promise<number>
  }
  assignment?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    update(args: unknown): Promise<unknown>
  }
  assignmentSubmission?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    upsert(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
  questionBank?: {
    create(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown[]>
    findUnique(args: unknown): Promise<unknown | null>
    upsert(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
    count(args: unknown): Promise<number>
  }
  studentRank?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    upsert(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
  promotionTest?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    update(args: unknown): Promise<unknown>
  }
  pkMatch?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    findFirst(args: unknown): Promise<unknown | null>
    update(args: unknown): Promise<unknown>
    upsert(args: unknown): Promise<unknown>
  }
  pkRound?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    findFirst(args: unknown): Promise<unknown | null>
    update(args: unknown): Promise<unknown>
    upsert(args: unknown): Promise<unknown>
  }
  season?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findFirst(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    update(args: unknown): Promise<unknown>
    upsert(args: unknown): Promise<unknown>
  }
  seasonReward?: {
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown | null>
    findFirst(args: unknown): Promise<unknown | null>
    findMany(args: unknown): Promise<unknown[]>
    update(args: unknown): Promise<unknown>
    upsert(args: unknown): Promise<unknown>
  }
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaLike
}

const prisma = (globalForPrisma.prisma ?? new PrismaClient()) as PrismaLike

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
