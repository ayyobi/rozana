/** Registre des widgets du dashboard.
 *  En phase 6, la disposition (visibilité, ordre, taille) sera lue et enregistrée
 *  dans la collection PocketBase `dashboard_widgets` ; cette valeur sert de défaut. */

export type WidgetId = 'priorities' | 'planning' | 'calendar' | 'projects' | 'habits' | 'finances';

export interface WidgetLayout {
  id: WidgetId;
  visible: boolean;
  order: number;
  /** Largeur sur la grille desktop de 12 colonnes. */
  size: 'sm' | 'md' | 'lg' | 'full';
}

export const ALLOWED_SIZES: Record<WidgetId, WidgetLayout['size'][]> = {
  priorities: ['md', 'lg', 'full'],
  planning: ['sm', 'md'],
  calendar: ['sm', 'md'],
  projects: ['sm', 'md', 'lg'],
  habits: ['sm', 'md', 'lg', 'full'],
  finances: ['sm', 'md', 'lg'],
};

export const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: 'priorities', visible: true, order: 0, size: 'lg' },
  { id: 'calendar', visible: true, order: 1, size: 'sm' },
  { id: 'planning', visible: true, order: 2, size: 'sm' },
  { id: 'habits', visible: true, order: 3, size: 'lg' },
  { id: 'projects', visible: true, order: 4, size: 'md' },
  { id: 'finances', visible: true, order: 5, size: 'md' },
];
