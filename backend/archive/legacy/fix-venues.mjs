/** Follow-up corrections to the 2026-11-01 import, applied through the store so they are audited. */
import { loadConfig } from '../../src/config.mjs';
import { Store } from '../../src/store.mjs';

const store = Store.open(loadConfig());
const audit = { author: 'legacy-import', note: 'Post-import correction' };
const venues = { '10.5194/egusphere-egu2020-8047': 'EGU General Assembly 2020', '10.1002/essoar.10502731.1': 'ESSOAr (preprint)', '10.2139/ssrn.5003164': 'SSRN (preprint)' };
for (const row of store.list('publications')) {
  if (venues[row.doi]) store.update('publications', row.id, { venue: venues[row.doi] }, audit);
}
const faiz = store.get('people', 'muhammad-abrar-faiz');
store.update('people', faiz.id, { bio_en: faiz.bio_en.replace('Faiz,completed', 'Faiz, completed') }, audit);
console.log('ok');
store.close();
