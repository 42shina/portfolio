import type { Career, Contact, Project } from './types';
import brand from './brand.json';
import navigation from './navigation.json';
import hero from './hero.json';
import work from './work.json';
import portfolio from './projects/portfolio.json';
import cozyctrl from './projects/cozyctrl.json';
import about from './about.json';
import career from './career.json';
import contact from './contact.json';
import footer from './footer.json';

const projects: Project[] = [cozyctrl, portfolio];
const careerContent: Career = career;
const contactContent: Contact = contact;

const content = {
  brand,
  navigation,
  hero,
  work,
  projects,
  about,
  career: careerContent,
  contact: contactContent,
  footer,
};

export default content;
