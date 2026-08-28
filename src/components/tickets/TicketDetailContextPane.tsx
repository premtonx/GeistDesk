import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Building2, Globe, Mail, PlusCircle, Sparkles, Tag, XCircle } from 'lucide-react';
import { RedesignedSidebar } from '../ticket-details/RedesignedSidebar';
import type { Ticket as TicketType, Contact, Company } from '../../types';
import type { SuggestedLink } from '../../services/neuralLinkService';

export interface TicketDetailContextPaneProps {
  selectedTicket: TicketType;
  ticketContact: Contact | null;
  ticketCompany: Company | null;
  isMobilePropertiesOpen: boolean;
  setIsMobilePropertiesOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isAiReady: boolean;
  isAiDrafting: boolean;
  generateAiReply: () => void;
  handleConvertToKB: () => void;
  suggestedNeuralLinks: SuggestedLink[];
  linkTicket: (ticketId: string) => void;
  unlinkTicket: (ticketId: string) => void;
  newTagInput: string;
  setNewTagInput: (v: string) => void;
  initiateHandoff: (ticketId: string, data: unknown) => void;
  suggestedTags: string[];
  allTickets: TicketType[];
  handleInlineUpdate: (ticketId: string, data: Partial<TicketType>) => Promise<void> | void;
}

export function TicketDetailContextPane(props: TicketDetailContextPaneProps) {
  const {
    selectedTicket,
    ticketContact,
    ticketCompany,
    isMobilePropertiesOpen,
    setIsMobilePropertiesOpen,
    isAiReady,
    isAiDrafting,
    generateAiReply,
    handleConvertToKB,
    suggestedNeuralLinks,
    linkTicket,
    unlinkTicket,
    newTagInput,
    setNewTagInput,
    initiateHandoff,
    suggestedTags,
    allTickets,
    handleInlineUpdate,
  } = props;

  // Defensive: if the selected ticket disappears from the master list (e.g.
  // an assignment moved it out of the active filter), render a placeholder
  // instead of crashing on nested property access.
  if (!selectedTicket) {
    return (
      <aside className="shrink-0 w-[325px] border-l border-border bg-muted xl:flex xl:relative xl:sticky xl:top-6 xl:h-[calc(100vh-5rem)]">
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-xs text-muted-foreground font-medium">
            Kein Ticket ausgewählt. Bitte ein Ticket aus der Liste öffnen.
          </p>
        </div>
      </aside>
    );
  }

  const tags = selectedTicket.tags ?? [];

  return (
                <aside className={cn(
                  "shrink-0 border-l border-border overflow-y-auto custom-scrollbar z-30 transition-all",
                  // Desktop (xl+): a sticky in-flow properties column.
                  "xl:flex xl:relative xl:sticky xl:top-6 xl:h-[calc(100vh-5rem)] xl:w-[325px] xl:shadow-none xl:bg-muted",
                  isMobilePropertiesOpen
                    // Mobile/tablet: a full-height drawer that never exceeds the viewport.
                    ? "flex absolute inset-y-0 right-0 h-full w-[min(22rem,92vw)] shadow-2xl bg-white dark:bg-slate-900"
                    : "hidden bg-muted"
                )}>
                    <RedesignedSidebar 
                     ticket={selectedTicket}
                     contact={ticketContact}
                     company={ticketCompany}
                     onUpdateTicketField={(data) => {
                       handleInlineUpdate(selectedTicket.id, data);
                     }}
                      isAiReady={isAiReady}
                      isAiDrafting={isAiDrafting}
                      onDraftWithAI={generateAiReply}
                      onConvertToKB={handleConvertToKB}
                      suggestedNeuralLinks={suggestedNeuralLinks}
                      onLinkTicket={linkTicket}
                      onUnlinkTicket={unlinkTicket}
                      tagsInput={newTagInput}
                      onChangeTagsInput={setNewTagInput}
                      onInitiateHandoff={(data) => initiateHandoff(selectedTicket.id, data)}
                      onCloseMobile={() => setIsMobilePropertiesOpen(false)}
                      onAddTag={() => {
                        if (newTagInput.trim() && selectedTicket) {
                          handleInlineUpdate(selectedTicket.id, { tags: [...tags, newTagInput.trim()] });
                          setNewTagInput('');
                        }
                      }}
                      
                       suggestedTags={suggestedTags}
                      allTickets={allTickets}
                      
                    />
           </aside>
  );
}
