"use client";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable as BaseDataTable } from "@/components/admin/project-data-table/data-table";
import type { ArteEducador } from "../ArteEducadorManager";

interface DataTableProps {
  columns: ColumnDef<ArteEducador, any>[];
  data: ArteEducador[];
}

export function DataTable({ columns, data }: DataTableProps) {
  return <BaseDataTable columns={columns} data={data} />;
} 