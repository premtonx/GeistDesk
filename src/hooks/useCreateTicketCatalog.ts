import { useEffect, useState } from 'react';
import { customerService } from '../services/customerService';
import { userService } from '../services/userService';
import type { Company, User } from '../types';

/** Prefetch ticket-creation dropdown data on workspace mount (frame-zero ready). */
export function useCreateTicketCatalog(enabled = true) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let companiesReady = false;
    let agentsReady = false;
    const markReady = () => {
      if (companiesReady && agentsReady) setReady(true);
    };

    const unsubCompanies = customerService.subscribeToCompanies((next) => {
      setCompanies(next);
      companiesReady = true;
      markReady();
    });

    const unsubAgents = userService.subscribeToUsers((next) => {
      setAgents(next);
      agentsReady = true;
      markReady();
    });

    return () => {
      unsubCompanies();
      unsubAgents();
    };
  }, [enabled]);

  return { companies, agents, ready };
}
