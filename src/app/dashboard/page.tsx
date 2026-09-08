"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseChart } from "@/components/ExpenseChart";
import { MonthlyHistory } from "@/components/MonthlyHistory";
import { StoreTicket } from "@/components/StoreTicket";

interface DashboardData {
  summary: {
    totalSpent: number;
    totalInvoices: number;
    averageTicket: number;
    uniqueProducts: number;
  };
  categoryExpenses: {
    category: string;
    total: number;
    count: number;
  }[];
  monthlyHistory: {
    month: string;
    total: number;
    count: number;
  }[];
  storeTickets: {
    store: string;
    total: number;
    count: number;
    average: number;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) {
          throw new Error("Erro ao carregar dashboard");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Carregando...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (!data) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Nenhum dado disponível</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Acompanhe seus gastos com alimentos</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Total Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              R$ {data.summary.totalSpent.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Notas Fiscais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.summary.totalInvoices}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              R$ {data.summary.averageTicket.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Produtos Únicos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.summary.uniqueProducts}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseChart data={data.categoryExpenses} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyHistory data={data.monthlyHistory} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Médio por Estabelecimento</CardTitle>
        </CardHeader>
        <CardContent>
          <StoreTicket data={data.storeTickets} />
        </CardContent>
      </Card>
    </div>
  );
}
