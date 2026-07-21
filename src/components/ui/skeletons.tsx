import { Skeleton } from './skeleton';
import { Card, CardContent, CardHeader } from './card';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   Reusable Skeleton Primitives for ByteBeacon
   ───────────────────────────────────────────── */

/** Skeleton stat card — icon circle + value + label */
export function SkeletonStatCard({ className }: { className?: string }) {
    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
            </CardContent>
        </Card>
    );
}

/** Skeleton for a row of stat cards */
export function SkeletonStatsRow({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonStatCard key={i} />
            ))}
        </div>
    );
}

/** Skeleton table row */
export function SkeletonTableRow({ columns = 7 }: { columns?: number }) {
    const widths = ['w-20', 'w-28', 'w-16', 'w-16', 'w-20', 'w-20', 'w-24'];
    return (
        <tr className="border-b border-border">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="p-4">
                    <Skeleton className={cn("h-4 rounded", widths[i % widths.length])} />
                </td>
            ))}
        </tr>
    );
}

/** Skeleton for a full table with header + rows */
export function SkeletonTable({ rows = 5, columns = 7 }: { rows?: number; columns?: number }) {
    return (
        <Card>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                {Array.from({ length: columns }).map((_, i) => (
                                    <th key={i} className="p-4 text-left">
                                        <Skeleton className="h-3 w-16 rounded" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: rows }).map((_, i) => (
                                <SkeletonTableRow key={i} columns={columns} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

/** Skeleton for a mobile card-style list item */
export function SkeletonMobileCard() {
    return (
        <div className="p-4 space-y-3 border-b border-border">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-12 rounded" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-20" />
            </div>
        </div>
    );
}

/** Skeleton for order/card grid items */
export function SkeletonOrderCard() {
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
            </CardContent>
        </Card>
    );
}

/** Skeleton for cards in a grid */
export function SkeletonCardGrid({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
    const gridClass = cols === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : cols === 4
            ? 'grid-cols-2 md:grid-cols-4'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    return (
        <div className={cn("grid gap-6", gridClass)}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonOrderCard key={i} />
            ))}
        </div>
    );
}

/** Skeleton for profile page — avatar + form fields */
export function SkeletonProfile() {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-4 w-56" />
                </div>
            </div>
            {/* Avatar card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-36" />
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </div>
                </CardContent>
            </Card>
            {/* Form cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[0, 1].map(i => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-5 w-32" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[0, 1, 2].map(j => (
                                <div key={j} className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-10 w-full rounded-md" />
                                </div>
                            ))}
                            <Skeleton className="h-10 w-full rounded-md" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

/** Skeleton for message/notification list */
export function SkeletonMessageList({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Skeleton for the dashboard home — stats + quick actions + recent */
export function SkeletonDashboardHome() {
    return (
        <div className="space-y-6">
            {/* Welcome header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            {/* Stats row */}
            <SkeletonStatsRow count={4} />
            {/* Quick actions + chart area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <Skeleton className="h-5 w-32" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-48 w-full rounded-lg" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-28" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full rounded-lg" />
                        ))}
                    </CardContent>
                </Card>
            </div>
            {/* Recent transactions */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="p-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="px-4 py-3 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-8 w-8 rounded-lg" />
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                            </div>
                            <div className="text-right space-y-1">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

/** Skeleton for wallet page — balance card + deposit history */
export function SkeletonWalletPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-4 w-48" />
                </div>
            </div>
            {/* Balance card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-40" />
                        </div>
                        <Skeleton className="h-12 w-12 rounded-2xl" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-10 w-32 rounded-lg" />
                        <Skeleton className="h-10 w-32 rounded-lg" />
                    </div>
                </CardContent>
            </Card>
            {/* Transactions */}
            <SkeletonTable rows={5} columns={5} />
        </div>
    );
}

/** Skeleton for data bundles page — network tabs + bundle grid */
export function SkeletonDataBundlesPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-36" />
                    <Skeleton className="h-4 w-56" />
                </div>
            </div>
            {/* Network tabs */}
            <div className="flex gap-3">
                {[0, 1, 2].map(i => (
                    <Skeleton key={i} className="h-10 w-28 rounded-lg" />
                ))}
            </div>
            {/* Bundle grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-6 w-16 rounded" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                            </div>
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full rounded-lg" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

/** Skeleton for settings page — form sections */
export function SkeletonSettingsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-4 w-48" />
                </div>
            </div>
            {/* Tab bar */}
            <div className="flex gap-2 border-b border-border pb-2">
                {[0, 1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-9 w-24 rounded-lg" />
                ))}
            </div>
            {/* Settings sections */}
            {[0, 1].map(i => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-5 w-36" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[0, 1, 2].map(j => (
                            <div key={j} className="flex items-center justify-between py-3">
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-48" />
                                </div>
                                <Skeleton className="h-6 w-11 rounded-full" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

/** Skeleton for admin dashboard — stats + tables + charts */
export function SkeletonAdminDashboard() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
            <SkeletonStatsRow count={4} />
            {/* Role stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map(i => (
                    <Card key={i}>
                        <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-28" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Skeleton className="h-6 w-20" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-24" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            {/* Recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                                <Skeleton className="h-4 w-20" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-28" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

/** Skeleton for developer API page */
export function SkeletonDeveloperApiPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-4 w-56" />
                </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-2">
                {[0, 1].map(i => (
                    <Skeleton key={i} className="h-10 w-32 rounded-lg" />
                ))}
            </div>
            {/* Content area */}
            <Card>
                <CardContent className="p-6 space-y-4">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-10 w-full rounded-md" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

/** Generic page skeleton — header + filter bar + table */
export function SkeletonListPage({ title = true }: { title?: boolean }) {
    return (
        <div className="space-y-6">
            {title && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-7 w-36" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-24 rounded-lg" />
                        <Skeleton className="h-9 w-28 rounded-lg" />
                    </div>
                </div>
            )}
            {/* Filter bar */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Skeleton className="h-10 flex-1 rounded-md" />
                        <div className="flex gap-2">
                            {[0, 1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-9 w-20 rounded-lg" />
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
            {/* Table */}
            <SkeletonTable rows={6} columns={7} />
        </div>
    );
}
