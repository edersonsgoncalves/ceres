import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      include: {
        items: true,
        store: true,
      },
      orderBy: { issueDate: "desc" },
    });

    const totalSpent = invoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0
    );
    const totalInvoices = invoices.length;
    const averageTicket = totalInvoices > 0 ? totalSpent / totalInvoices : 0;

    const uniqueProducts = new Set(
      invoices.flatMap((inv) =>
        inv.items.map((item) => item.name || "Produto sem nome")
      )
    ).size;

    const categoryMap = new Map<string, { total: number; count: number; items: { name: string; unitPrice: number; quantity: number; invoiceDate: Date; store: string }[] }>();
    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const category = item.category || "Sem categoria";
        const existing = categoryMap.get(category) || { total: 0, count: 0, items: [] };
        existing.total += Number(item.totalPrice);
        existing.count++;
        existing.items.push({
          name: item.name || "Item",
          unitPrice: Number(item.unitPrice),
          quantity: Number(item.quantity),
          invoiceDate: inv.issueDate,
          store: (inv.store as { name: string }).name,
        });
        categoryMap.set(category, existing);
      });
    });

    const categoryExpenses = Array.from(categoryMap.entries()).map(
      ([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        items: data.items.slice(0, 10),
      })
    );

    const monthlyMap = new Map<string, { total: number; count: number; invoices: { id: string; storeName: string; total: number; date: string }[] }>();
    invoices.forEach((inv) => {
      const date = new Date(inv.issueDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(monthKey) || { total: 0, count: 0, invoices: [] };
      existing.total += Number(inv.totalAmount);
      existing.count++;
      existing.invoices.push({
        id: inv.id,
        storeName: (inv.store as { name: string }).name,
        total: Number(inv.totalAmount),
        date: inv.issueDate.toISOString(),
      });
      monthlyMap.set(monthKey, existing);
    });

    const monthlyHistory = Array.from(monthlyMap.entries())
      .map(([key, data]) => {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          month: date.toLocaleDateString("pt-BR", {
            month: "short",
            year: "numeric",
          }),
          total: data.total,
          count: data.count,
          invoices: data.invoices,
        };
      })
      .slice(0, 12);

    const storeMap = new Map<string, { total: number; count: number; invoices: { id: string; total: number; date: string; itemsCount: number }[] }>();
    invoices.forEach((inv) => {
      const storeName = (inv.store as { name: string }).name || "Desconhecido";
      const existing = storeMap.get(storeName) || { total: 0, count: 0, invoices: [] };
      existing.total += Number(inv.totalAmount);
      existing.count++;
      existing.invoices.push({
        id: inv.id,
        total: Number(inv.totalAmount),
        date: inv.issueDate.toISOString(),
        itemsCount: inv.totalItemsCount,
      });
      storeMap.set(storeName, existing);
    });

    const storeTickets = Array.from(storeMap.entries()).map(
      ([store, data]) => ({
        store,
        total: data.total,
        count: data.count,
        average: data.count > 0 ? data.total / data.count : 0,
        invoices: data.invoices,
      })
    );

    return NextResponse.json({
      summary: {
        totalSpent,
        totalInvoices,
        averageTicket,
        uniqueProducts,
      },
      categoryExpenses,
      monthlyHistory,
      storeTickets,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
