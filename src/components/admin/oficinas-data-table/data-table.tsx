"use client";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable as BaseDataTable } from "@/components/admin/project-data-table/data-table";
import type { Oficina } from "../OficinaManager";

interface DataTableProps {
  columns: ColumnDef<Oficina, any>[];
  data: Oficina[];
}

export function DataTable({ columns, data }: DataTableProps) {
  return <BaseDataTable columns={columns} data={data} />;
} 