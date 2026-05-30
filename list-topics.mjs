import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
})

const topics = await prisma.topic.findMany({
  where: { is_published: true },
  include: {
    subject: { select: { name: true } },
    year_group: { select: { label: true } },
  },
  orderBy: [
    { subject: { name: 'asc' } },
    { year_group: { label: true } },
    { order_index: 'asc' },
  ],
})

for (const t of topics) {
  console.log(`${t.id} | ${t.year_group.label} | ${t.subject.name} | ${t.title}`)
}

await prisma.$disconnect()
