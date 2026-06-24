import prisma from "../db.server";

export async function findOrCreateCustomer(
  merchantId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    note?: string;
  },
) {
  const { firstName, lastName, email, phone } = data;

  const existing = await prisma.customer.findFirst({
    where: { merchantId, email },
  });

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        phone,
      },
    });
  }

  return prisma.customer.create({
    data: { merchantId, firstName, lastName, email, phone },
  });
}
