"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";

interface Order {
  id: number;
  itemType: string;
  amount: string | number;
  discount: string | number;
  finalAmount: string | number;
  couponCode: string | null;
  status: string;
  razorpayPaymentId: string | null;
  createdAt: string;
  student: { id: number; name: string; email: string };
  test: { id: number; name: string } | null;
  bundle: { id: number; name: string } | null;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (search) params.set("search", search);
    params.set("page", String(page));

    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    if (data.ok) {
      setOrders(data.data.orders);
      setTotalPages(data.data.totalPages);
    }
    setLoading(false);
  }, [page, filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader title="Orders" subtitle="All payment transactions" />

      <div className="rounded-2xl border bg-card shadow-soft p-4 sm:p-5 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by student name, email, or payment ID" className="pl-10" />
          </div>
          <Button type="submit">Search</Button>
        </form>
        <Select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="max-w-xs">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
        </Select>
      </div>

      {/* TODO 5.2-F4: consider a card-list view on mobile instead of horizontal scroll. */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">No orders</div>
        ) : (
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Coupon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">#{o.id}</TableCell>
                  <TableCell className="text-xs">{new Date(o.createdAt).toLocaleDateString("en-IN")}<br /><span className="text-muted-foreground">{new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></TableCell>
                  <TableCell>
                    <div className="font-medium">{o.student.name}</div>
                    <div className="text-xs text-muted-foreground">{o.student.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{o.itemType}</Badge>
                    <div className="text-xs mt-1 line-clamp-1">{o.test?.name || o.bundle?.name || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">₹{o.finalAmount}</div>
                    {Number(o.discount) > 0 && (
                      <div className="text-xs text-muted-foreground line-through">₹{o.amount}</div>
                    )}
                  </TableCell>
                  <TableCell>{o.couponCode ? <Badge variant="default" className="font-mono text-[10px]">{o.couponCode}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <Badge variant={o.status === "PAID" ? "success" : o.status === "FAILED" ? "destructive" : "secondary"}>
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {o.razorpayPaymentId || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      )}
    </div>
  );
}
