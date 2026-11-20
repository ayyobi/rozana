import { useMemo } from 'react';
import { useList } from './useList';

/** Données de référence partagées (catégories, projets, sections). */
export function usePlanningRefs() {
  const categories = useList('categories', { sort: 'sort,name' });
  const projects = useList('projects', { sort: 'name', filter: 'status != "archived"' });
  const sections = useList('project_sections', { sort: 'sort,name' });
  const catById = useMemo(() => new Map(categories.items.map((c) => [c.id, c])), [categories.items]);
  const projectById = useMemo(() => new Map(projects.items.map((p) => [p.id, p])), [projects.items]);
  return {
    categories: categories.items,
    projects: projects.items,
    sections: sections.items,
    catById,
    projectById,
    loading: categories.loading || projects.loading,
  };
}

export function useFinanceRefs() {
  const accounts = useList('finance_accounts', { sort: 'name', filter: 'archived = false' });
  const categories = useList('finance_categories', { sort: 'kind,sort,name' });
  const catById = useMemo(() => new Map(categories.items.map((c) => [c.id, c])), [categories.items]);
  const accountById = useMemo(() => new Map(accounts.items.map((a) => [a.id, a])), [accounts.items]);
  return { accounts: accounts.items, categories: categories.items, catById, accountById, loading: accounts.loading || categories.loading };
}
