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

export default {
  brand,
  navigation,
  hero,
  work,
  projects: [cozyctrl, portfolio],
  about,
  career,
  contact,
  footer,
};
