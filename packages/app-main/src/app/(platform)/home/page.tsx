"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import MoonBase from "@/public/imgs/MoonBase.png";
import { Button } from "@common/components/ui/Button";
import { Card, CardContent } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
	IconPlus,
	IconTrendingUp,
	IconCalendar,
	IconBell,
	IconFlame,
} from "@tabler/icons-react";
import { useUserStore } from "@/lib/stores/userStore";

interface HomeMetrics {
	activitiesThisWeek: number;
	activitiesThisMonth: number;
	pendingFollowUpsCount: number;
	streak: { current: number };
}

export default function Page() {
	const router = useRouter();
	const { user } = useUserStore();
	const [metrics, setMetrics] = useState<HomeMetrics | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadMetrics = async () => {
			try {
				const response = await fetch("/api/dashboard/metrics");
				if (response.ok) {
					const data = await response.json();
					setMetrics(data);
				}
			} catch (error) {
				console.error("Failed to load metrics:", error);
			} finally {
				setIsLoading(false);
			}
		};
		loadMetrics();
	}, []);

	return (
		<div className="bg-[#FFFFFF] min-h-full">
			{/* Welcome Banner */}
			<div className="p-6 max-w-7xl mx-auto">
				<Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold">
									Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
								</h1>
								<p className="text-muted-foreground mt-1">
									Track your progress and stay on top of your goals.
								</p>
							</div>
							<Link href="/update">
								<Button size="lg" className="gap-2">
									<IconPlus className="h-5 w-5" />
									Log Today&apos;s Update
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* MoonBase Hero Banner */}
			<div className="relative w-full h-[400px] md:h-[500px] overflow-hidden">
				<Image
					src={MoonBase}
					alt="Achievely - Your Command Center"
					fill
					className="object-cover"
					priority
				/>
				{/* White inner shadow at bottom */}
				<div className="absolute inset-0 shadow-[inset_0_-80px_60px_-20px_rgba(255,255,255,0.95)]" />
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="text-center flex flex-col items-center justify-center">
						<h1 className="text-4xl md:text-5xl font-bold mb-2 text-black">
							Clio
						</h1>
						<p className="text-lg md:text-xl text-gray-700 mb-6 bg-white/90 from-white/90 via-white/90 to-white/90 rounded-lg px-3 py-1 shadow-[0_0_25px_15px_rgba(255,255,255,0.95),0_0_50px_25px_rgba(255,255,255,0.6)]">
							Your mission control for personal achievement and metrics 
						</p>
						<Button
							onClick={() => router.push("/update")}
							className="bg-primary text-primary-foreground border border-primary/20 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
							size="lg"
						>
							<IconPlus className="mr-2 h-5 w-5" />
							New Update
						</Button>
					</div>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="p-6 max-w-7xl mx-auto">
				<div className="grid gap-4 md:grid-cols-4">
					{/* Activities This Week */}
					<Card>
						<CardContent className="p-6">
							{isLoading ? (
								<Skeleton className="h-20 w-full" />
							) : (
								<div className="flex items-center gap-4">
									<div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3">
										<IconTrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
									</div>
									<div>
										<div className="text-3xl font-bold tabular-nums">
											{metrics?.activitiesThisWeek || 0}
										</div>
										<div className="text-sm text-muted-foreground">
											This Week
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Activities This Month */}
					<Card>
						<CardContent className="p-6">
							{isLoading ? (
								<Skeleton className="h-20 w-full" />
							) : (
								<div className="flex items-center gap-4">
									<div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-3">
										<IconCalendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
									</div>
									<div>
										<div className="text-3xl font-bold tabular-nums">
											{metrics?.activitiesThisMonth || 0}
										</div>
										<div className="text-sm text-muted-foreground">
											This Month
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Pending Follow-ups */}
					<Card>
						<CardContent className="p-6">
							{isLoading ? (
								<Skeleton className="h-20 w-full" />
							) : (
								<Link href="/follow-ups" className="block">
									<div className="flex items-center gap-4">
										<div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
											<IconBell className="h-6 w-6 text-amber-600 dark:text-amber-400" />
										</div>
										<div>
											<div className="text-3xl font-bold tabular-nums">
												{metrics?.pendingFollowUpsCount || 0}
											</div>
											<div className="text-sm text-muted-foreground">
												Follow-ups
											</div>
										</div>
									</div>
								</Link>
							)}
						</CardContent>
					</Card>

					{/* Current Streak */}
					<Card>
						<CardContent className="p-6">
							{isLoading ? (
								<Skeleton className="h-20 w-full" />
							) : (
								<div className="flex items-center gap-4">
									<div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-3">
										<IconFlame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
									</div>
									<div>
										<div className="text-3xl font-bold tabular-nums">
											{metrics?.streak?.current || 0}
										</div>
										<div className="text-sm text-muted-foreground">
											Day Streak
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
