import type hero from './hero.json';
import type about from './about.json';
import type work from './work.json';
import type footer from './footer.json';

export type Hero = typeof hero;
export type About = typeof about;
export type Work = typeof work;
export type Footer = typeof footer;
export interface Link { label: string; href: string }
export interface LabelText { label: string; text: string }
export interface Tag { name: string; kind?: string }
export interface Condition { label: string; text?: string; items?: string[]; note?: LabelText }
export interface Contact { eyebrow: string; title: string; description: string; conditions: Condition[]; links: Link[]; note?: string }
export interface CareerPoint { period: string; text: string; responsibilities?: LabelText[]; skills?: Tag[]; skillsProvisional?: boolean }
export interface Career { eyebrow: string; title: string; intro: string; items: { title: string; points?: CareerPoint[]; text?: string; link?: Link; afterLink?: string }[] }
export interface Project {
  id: string;
  number: string;
  title: string;
  visual: string;
  visualLabel: string;
  visualDescription: string;
  wide?: boolean;
  description: string;
  details: LabelText[];
  tags: (string | Tag)[];
  diagrams?: { src: string; alt: string; caption?: string }[];
  link?: Link | null;
  pendingLinkText?: string;
  highlights?: LabelText[];
}
