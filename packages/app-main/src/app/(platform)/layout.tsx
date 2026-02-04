import "@/src/globals.css";
import SideMenu from "@/app/components/sideMenu/sideMenu";
import { PageContentContainer } from "@/app/components/ui/PageContentContainer";
import { LegalFooter } from "@common/components/ui/LegalFooter";
import { PopupModalWrapper } from "@/app/components/modals/PopupModalWrapper";
import { CurrentUserProvider } from "@/app/components/providers/currentUserProvider";
import { requireAuthGuard } from "@/lib/auth-guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
	await requireAuthGuard();

	return (
		<CurrentUserProvider>
			<div className="min-h-screen w-full bg-background">
				<SideMenu />
				<div className="flex w-full justify-center">
					<PageContentContainer
						className="flex flex-col items-center justify-between bg-background min-h-screen"
						variant="blank"
						considerSideMenu={true}
						useUIState={true}
					>
						<div className="w-full flex-1">{children}</div>
						<LegalFooter className="px-4" />
					</PageContentContainer>
				</div>
				<PopupModalWrapper />
			</div>
		</CurrentUserProvider>
	);
}
