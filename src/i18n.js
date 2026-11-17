// All UI text in 13 languages (Latin script, so the Sniglet and Comfortaa fonts cover them).
// English is the default. Translations are first drafts: have a native speaker check them before release.

export const LANGS = [
  ['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['fr', 'Français'],
  ['de', 'Deutsch'], ['id', 'Bahasa Indonesia'], ['tr', 'Türkçe'], ['it', 'Italiano'],
  ['nb', 'Norsk'], ['sv', 'Svenska'], ['da', 'Dansk'], ['fi', 'Suomi'], ['is', 'Íslenska']
];

// Keys, in order, for the compact tables below
const KEYS = [
  'introSub', 'altitude', 'boilsAt', 'longer',
  'sizeS', 'sizeM', 'sizeL', 'soft', 'smile', 'hard',
  'start1', 'start2', 'cancel', 'stopAlarm',
  'tipDrag', 'tipTilt', 'tipStart', 'doneMsg', 'collected', 'bonus', 'bumps', 'streak',
  'settings', 'appearance', 'system', 'light', 'dark', 'language',
  'myValues', 'myValuesNote', 'homeAlt', 'reset',
  'eggSizes', 'gramsS', 'gramsM', 'gramsL', 'sizesNote', 'lab', 'close',
  'ariaSmaller', 'ariaLarger', 'ariaSofter', 'ariaFirmer',
  'tipEgg', 'tipPlusMinus', 'tipMenu', 'backToTimer'
];

// {t} = temperature, {p} = percent, {n} = count
const TABLE = {
  en: ['Start the timer when the egg goes into boiling water.', 'Altitude', 'Boils at {t} °C', '{p} % longer',
    'Small egg', 'Medium egg', 'Large egg', 'Soft-boiled', 'Jammy', 'Hard-boiled',
    'Start', 'timer', 'Cancel', 'Stop alarm',
    'Drag on the screen to roll the egg.', 'Tilt the phone to roll the egg.', 'Tap the egg to start.',
    'The egg is ready! Lift it out and rinse it in cold water.', '{n} eggs collected', 'bonus', 'bumps', 'streak',
    'Settings', 'Appearance', 'System', 'Light', 'Dark', 'Language',
    'My values', 'Your times for a medium egg, straight from the fridge into boiling water, where you live. Small and large eggs and other altitudes are worked out from these.', 'Altitude where you live', 'Reset to standard',
    'Egg sizes', 'Small: under 53 g', 'Medium: 53–63 g', 'Large: over 63 g', 'Times are for eggs straight from the fridge, lowered into boiling water.', 'Lab (for developers)', 'Close',
    'Smaller egg', 'Larger egg', 'Softer yolk', 'Firmer yolk',
    'Tap the egg to start the timer.', 'Use − and + to pick the egg size and the yolk.', 'Tap ⋯ for language, dark mode and your own times.', 'Back to the countdown'],
  es: ['Inicia el temporizador cuando el huevo entre en el agua hirviendo.', 'Altitud', 'Hierve a {t} °C', '{p} % más tiempo',
    'Huevo pequeño', 'Huevo mediano', 'Huevo grande', 'Pasado por agua', 'Mollet', 'Duro',
    'Iniciar', 'reloj', 'Cancelar', 'Parar alarma',
    'Arrastra en la pantalla para rodar el huevo.', 'Inclina el teléfono para rodar el huevo.', 'Toca el huevo para empezar.',
    '¡El huevo está listo! Sácalo y enjuágalo con agua fría.', '{n} huevos recogidos', 'bonus', 'golpes', 'racha',
    'Ajustes', 'Apariencia', 'Sistema', 'Claro', 'Oscuro', 'Idioma',
    'Mis valores', 'Tus tiempos para un huevo mediano, recién sacado de la nevera y puesto en agua hirviendo, donde vives. Los huevos pequeños y grandes y otras altitudes se calculan a partir de ellos.', 'Altitud donde vives', 'Restablecer',
    'Tamaños de huevo', 'Pequeño: menos de 53 g', 'Mediano: 53–63 g', 'Grande: más de 63 g', 'Los tiempos son para huevos recién sacados de la nevera, puestos en agua hirviendo.', 'Lab (para desarrolladores)', 'Cerrar',
    'Huevo más pequeño', 'Huevo más grande', 'Yema más blanda', 'Yema más firme',
    'Toca el huevo para iniciar el reloj.', 'Usa − y + para elegir el tamaño del huevo y la yema.', 'Toca ⋯ para el idioma, el modo oscuro y tus propios tiempos.', 'Volver a la cuenta atrás'],
  pt: ['Inicie o temporizador quando o ovo entrar na água fervente.', 'Altitude', 'Ferve a {t} °C', '{p} % mais tempo',
    'Ovo pequeno', 'Ovo médio', 'Ovo grande', 'Quente', 'Cremoso', 'Cozido',
    'Iniciar', 'relógio', 'Cancelar', 'Parar alarme',
    'Arraste na tela para rolar o ovo.', 'Incline o telefone para rolar o ovo.', 'Toque no ovo para começar.',
    'O ovo está pronto! Retire-o e passe por água fria.', '{n} ovos coletados', 'bônus', 'batidas', 'sequência',
    'Configurações', 'Aparência', 'Sistema', 'Claro', 'Escuro', 'Idioma',
    'Meus valores', 'Seus tempos para um ovo médio, direto da geladeira para a água fervente, onde você mora. Ovos pequenos e grandes e outras altitudes são calculados a partir deles.', 'Altitude onde você mora', 'Restaurar padrão',
    'Tamanhos de ovo', 'Pequeno: menos de 53 g', 'Médio: 53–63 g', 'Grande: mais de 63 g', 'Os tempos valem para ovos direto da geladeira, colocados em água fervente.', 'Lab (para desenvolvedores)', 'Fechar',
    'Ovo menor', 'Ovo maior', 'Gema mais mole', 'Gema mais firme',
    'Toque no ovo para iniciar o relógio.', 'Use − e + para escolher o tamanho do ovo e a gema.', 'Toque em ⋯ para idioma, modo escuro e seus próprios tempos.', 'Voltar à contagem'],
  fr: ['Lancez le minuteur quand l’œuf entre dans l’eau bouillante.', 'Altitude', 'Bout à {t} °C', '{p} % plus long',
    'Petit œuf', 'Œuf moyen', 'Gros œuf', 'À la coque', 'Mollet', 'Dur',
    'Lancer', 'minuteur', 'Annuler', 'Arrêter l’alarme',
    'Glissez sur l’écran pour faire rouler l’œuf.', 'Inclinez le téléphone pour faire rouler l’œuf.', 'Touchez l’œuf pour commencer.',
    'L’œuf est prêt ! Sortez-le et rincez-le à l’eau froide.', '{n} œufs ramassés', 'bonus', 'chocs', 'série',
    'Réglages', 'Apparence', 'Système', 'Clair', 'Sombre', 'Langue',
    'Mes valeurs', 'Vos temps pour un œuf moyen, sorti du frigo et plongé dans l’eau bouillante, chez vous. Les petits et gros œufs et les autres altitudes en sont déduits.', 'Altitude chez vous', 'Rétablir les valeurs standard',
    'Tailles d’œufs', 'Petit : moins de 53 g', 'Moyen : 53–63 g', 'Gros : plus de 63 g', 'Les temps valent pour des œufs sortis du frigo, plongés dans l’eau bouillante.', 'Lab (pour développeurs)', 'Fermer',
    'Œuf plus petit', 'Œuf plus gros', 'Jaune plus coulant', 'Jaune plus ferme',
    'Touchez l’œuf pour lancer le minuteur.', 'Utilisez − et + pour choisir la taille de l’œuf et le jaune.', 'Touchez ⋯ pour la langue, le mode sombre et vos propres temps.', 'Revenir au compte à rebours'],
  de: ['Starte den Timer, wenn das Ei ins kochende Wasser kommt.', 'Höhe', 'Siedet bei {t} °C', '{p} % länger',
    'Kleines Ei', 'Mittleres Ei', 'Großes Ei', 'Weich', 'Wachsweich', 'Hart',
    'Timer', 'starten', 'Abbrechen', 'Alarm stoppen',
    'Wische über den Bildschirm, um das Ei zu rollen.', 'Neige das Handy, um das Ei zu rollen.', 'Tippe auf das Ei, um zu starten.',
    'Das Ei ist fertig! Herausnehmen und kalt abschrecken.', '{n} Eier gesammelt', 'Bonus', 'Stöße', 'Serie',
    'Einstellungen', 'Darstellung', 'System', 'Hell', 'Dunkel', 'Sprache',
    'Meine Werte', 'Deine Zeiten für ein mittleres Ei, direkt aus dem Kühlschrank ins kochende Wasser, dort wo du wohnst. Kleine und große Eier und andere Höhen werden daraus berechnet.', 'Höhe, wo du wohnst', 'Auf Standard zurücksetzen',
    'Eiergrößen', 'Klein: unter 53 g', 'Mittel: 53–63 g', 'Groß: über 63 g', 'Die Zeiten gelten für Eier direkt aus dem Kühlschrank, in kochendes Wasser gelegt.', 'Lab (für Entwickler)', 'Schließen',
    'Kleineres Ei', 'Größeres Ei', 'Weicheres Eigelb', 'Festeres Eigelb',
    'Tippe auf das Ei, um den Timer zu starten.', 'Mit − und + wählst du Eigröße und Eigelb.', 'Tippe auf ⋯ für Sprache, Dunkelmodus und eigene Zeiten.', 'Zurück zum Countdown'],
  id: ['Mulai pengatur waktu saat telur masuk ke air mendidih.', 'Ketinggian', 'Mendidih pada {t} °C', '{p}% lebih lama',
    'Telur kecil', 'Telur sedang', 'Telur besar', 'Setengah matang', 'Lembut', 'Matang',
    'Mulai', 'waktu', 'Batal', 'Hentikan alarm',
    'Geser layar untuk menggulirkan telur.', 'Miringkan ponsel untuk menggulirkan telur.', 'Ketuk telur untuk mulai.',
    'Telur sudah siap! Angkat dan bilas dengan air dingin.', '{n} telur terkumpul', 'bonus', 'benturan', 'beruntun',
    'Pengaturan', 'Tampilan', 'Sistem', 'Terang', 'Gelap', 'Bahasa',
    'Nilai saya', 'Waktu Anda untuk telur sedang, langsung dari kulkas ke air mendidih, di tempat Anda tinggal. Telur kecil dan besar serta ketinggian lain dihitung dari sini.', 'Ketinggian tempat tinggal', 'Kembalikan ke standar',
    'Ukuran telur', 'Kecil: di bawah 53 g', 'Sedang: 53–63 g', 'Besar: di atas 63 g', 'Waktu berlaku untuk telur langsung dari kulkas, dimasukkan ke air mendidih.', 'Lab (untuk pengembang)', 'Tutup',
    'Telur lebih kecil', 'Telur lebih besar', 'Kuning lebih lembek', 'Kuning lebih padat',
    'Ketuk telur untuk memulai waktu.', 'Gunakan − dan + untuk memilih ukuran telur dan kuningnya.', 'Ketuk ⋯ untuk bahasa, mode gelap, dan waktu Anda sendiri.', 'Kembali ke hitung mundur'],
  tr: ['Yumurta kaynar suya girdiğinde zamanlayıcıyı başlat.', 'Rakım', '{t} °C’de kaynar', '%{p} daha uzun',
    'Küçük yumurta', 'Orta yumurta', 'Büyük yumurta', 'Rafadan', 'Kayısı', 'Katı',
    'Saati', 'başlat', 'İptal', 'Alarmı durdur',
    'Yumurtayı yuvarlamak için ekranı sürükle.', 'Yumurtayı yuvarlamak için telefonu eğ.', 'Başlamak için yumurtaya dokun.',
    'Yumurta hazır! Çıkar ve soğuk suyla durula.', '{n} yumurta toplandı', 'bonus', 'çarpma', 'seri',
    'Ayarlar', 'Görünüm', 'Sistem', 'Açık', 'Koyu', 'Dil',
    'Değerlerim', 'Yaşadığın yerde, buzdolabından doğrudan kaynar suya giren orta boy bir yumurta için sürelerin. Küçük ve büyük yumurtalar ile diğer rakımlar bunlardan hesaplanır.', 'Yaşadığın yerin rakımı', 'Varsayılana dön',
    'Yumurta boyları', 'Küçük: 53 g altı', 'Orta: 53–63 g', 'Büyük: 63 g üstü', 'Süreler buzdolabından çıkıp kaynar suya konan yumurtalar içindir.', 'Lab (geliştiriciler için)', 'Kapat',
    'Daha küçük yumurta', 'Daha büyük yumurta', 'Daha yumuşak sarı', 'Daha sert sarı',
    'Saati başlatmak için yumurtaya dokun.', 'Yumurta boyunu ve sarısını − ve + ile seç.', 'Dil, koyu mod ve kendi sürelerin için ⋯ simgesine dokun.', 'Geri sayıma dön'],
  it: ['Avvia il timer quando l’uovo entra nell’acqua bollente.', 'Altitudine', 'Bolle a {t} °C', '{p}% più a lungo',
    'Uovo piccolo', 'Uovo medio', 'Uovo grande', 'Alla coque', 'Barzotto', 'Sodo',
    'Avvia', 'timer', 'Annulla', 'Ferma sveglia',
    'Trascina sullo schermo per far rotolare l’uovo.', 'Inclina il telefono per far rotolare l’uovo.', 'Tocca l’uovo per iniziare.',
    'L’uovo è pronto! Toglilo e sciacqualo in acqua fredda.', '{n} uova raccolte', 'bonus', 'urti', 'serie',
    'Impostazioni', 'Aspetto', 'Sistema', 'Chiaro', 'Scuro', 'Lingua',
    'I miei valori', 'I tuoi tempi per un uovo medio, appena tolto dal frigo e messo in acqua bollente, dove vivi. Uova piccole e grandi e altre altitudini vengono calcolate da qui.', 'Altitudine dove vivi', 'Ripristina standard',
    'Taglie delle uova', 'Piccolo: meno di 53 g', 'Medio: 53–63 g', 'Grande: più di 63 g', 'I tempi valgono per uova appena tolte dal frigo, messe in acqua bollente.', 'Lab (per sviluppatori)', 'Chiudi',
    'Uovo più piccolo', 'Uovo più grande', 'Tuorlo più morbido', 'Tuorlo più sodo',
    'Tocca l’uovo per avviare il timer.', 'Usa − e + per scegliere la taglia dell’uovo e il tuorlo.', 'Tocca ⋯ per lingua, modalità scura e i tuoi tempi.', 'Torna al conto alla rovescia'],
  nb: ['Start klokka når egget går ned i kokende vann.', 'Høyde over havet', 'Koker ved {t} °C', '{p} % lengre tid',
    'Lite egg', 'Medium egg', 'Stort egg', 'Bløtkokt', 'Smilende', 'Hardkokt',
    'Start', 'klokka', 'Avbryt', 'Stopp alarmen',
    'Dra på skjermen for å rulle egget.', 'Vipp telefonen for å rulle egget.', 'Trykk på egget for å starte.',
    'Egget er ferdig! Ta det opp og skyll i kaldt vann.', '{n} egg samlet', 'bonus', 'dult', 'rekke',
    'Innstillinger', 'Utseende', 'System', 'Lys', 'Mørk', 'Språk',
    'Mine verdier', 'Dine tider for et medium egg rett fra kjøleskapet, lagt i kokende vann, der du bor. Lite og stort egg og andre høyder regnes ut fra dette.', 'Høyde der du bor', 'Tilbakestill til standard',
    'Eggstørrelser', 'Lite: under 53 g', 'Medium: 53–63 g', 'Stort: over 63 g', 'Tidene gjelder egg rett fra kjøleskapet, lagt i kokende vann.', 'Lab (for utviklere)', 'Lukk',
    'Mindre egg', 'Større egg', 'Bløtere plomme', 'Fastere plomme',
    'Trykk på egget for å starte klokka.', 'Bruk − og + for å velge eggstørrelse og plomme.', 'Trykk på ⋯ for språk, mørk modus og dine egne tider.', 'Tilbake til nedtellingen'],
  sv: ['Starta klockan när ägget läggs i kokande vatten.', 'Höjd över havet', 'Kokar vid {t} °C', '{p} % längre tid',
    'Litet ägg', 'Mellanstort ägg', 'Stort ägg', 'Löskokt', 'Krämig', 'Hårdkokt',
    'Starta', 'klockan', 'Avbryt', 'Stoppa larmet',
    'Dra på skärmen för att rulla ägget.', 'Luta telefonen för att rulla ägget.', 'Tryck på ägget för att starta.',
    'Ägget är klart! Ta upp det och skölj i kallt vatten.', '{n} ägg samlade', 'bonus', 'knuffar', 'svit',
    'Inställningar', 'Utseende', 'System', 'Ljust', 'Mörkt', 'Språk',
    'Mina värden', 'Dina tider för ett mellanstort ägg direkt från kylen, lagt i kokande vatten, där du bor. Små och stora ägg och andra höjder räknas ut från detta.', 'Höjd där du bor', 'Återställ till standard',
    'Äggstorlekar', 'Litet: under 53 g', 'Mellan: 53–63 g', 'Stort: över 63 g', 'Tiderna gäller ägg direkt från kylen, lagda i kokande vatten.', 'Lab (för utvecklare)', 'Stäng',
    'Mindre ägg', 'Större ägg', 'Lösare gula', 'Fastare gula',
    'Tryck på ägget för att starta klockan.', 'Använd − och + för att välja äggstorlek och gula.', 'Tryck på ⋯ för språk, mörkt läge och dina egna tider.', 'Tillbaka till nedräkningen'],
  da: ['Start uret, når ægget kommer i kogende vand.', 'Højde over havet', 'Koger ved {t} °C', '{p} % længere tid',
    'Lille æg', 'Mellem æg', 'Stort æg', 'Blødkogt', 'Smilende', 'Hårdkogt',
    'Start', 'uret', 'Annuller', 'Stop alarmen',
    'Træk på skærmen for at rulle ægget.', 'Vip telefonen for at rulle ægget.', 'Tryk på ægget for at starte.',
    'Ægget er færdigt! Tag det op og skyl det i koldt vand.', '{n} æg samlet', 'bonus', 'stød', 'stribe',
    'Indstillinger', 'Udseende', 'System', 'Lys', 'Mørk', 'Sprog',
    'Mine værdier', 'Dine tider for et mellem æg direkte fra køleskabet, lagt i kogende vand, der hvor du bor. Små og store æg og andre højder regnes ud fra det.', 'Højde, hvor du bor', 'Nulstil til standard',
    'Æggestørrelser', 'Lille: under 53 g', 'Mellem: 53–63 g', 'Stort: over 63 g', 'Tiderne gælder æg direkte fra køleskabet, lagt i kogende vand.', 'Lab (for udviklere)', 'Luk',
    'Mindre æg', 'Større æg', 'Blødere blomme', 'Fastere blomme',
    'Tryk på ægget for at starte uret.', 'Brug − og + til at vælge æggestørrelse og blomme.', 'Tryk på ⋯ for sprog, mørk tilstand og dine egne tider.', 'Tilbage til nedtællingen'],
  fi: ['Käynnistä ajastin, kun muna laitetaan kiehuvaan veteen.', 'Korkeus merenpinnasta', 'Kiehuu {t} °C:ssa', '{p} % pidempään',
    'Pieni muna', 'Keskikokoinen muna', 'Iso muna', 'Löysä', 'Pehmeä', 'Kova',
    'Käynnistä', 'ajastin', 'Peruuta', 'Pysäytä hälytys',
    'Vedä näyttöä vierittääksesi munaa.', 'Kallista puhelinta vierittääksesi munaa.', 'Napauta munaa aloittaaksesi.',
    'Muna on valmis! Nosta se pois ja huuhtele kylmällä vedellä.', '{n} munaa kerätty', 'bonus', 'töytäisyt', 'putki',
    'Asetukset', 'Ulkoasu', 'Järjestelmä', 'Vaalea', 'Tumma', 'Kieli',
    'Omat arvot', 'Omat aikasi keskikokoiselle munalle suoraan jääkaapista kiehuvaan veteen, siellä missä asut. Pienet ja isot munat sekä muut korkeudet lasketaan näistä.', 'Asuinpaikan korkeus', 'Palauta oletukset',
    'Munakoot', 'Pieni: alle 53 g', 'Keskikoko: 53–63 g', 'Iso: yli 63 g', 'Ajat koskevat munia suoraan jääkaapista kiehuvaan veteen.', 'Lab (kehittäjille)', 'Sulje',
    'Pienempi muna', 'Isompi muna', 'Löysempi keltuainen', 'Kiinteämpi keltuainen',
    'Napauta munaa käynnistääksesi ajastimen.', 'Valitse munan koko ja keltuainen − ja + -painikkeilla.', 'Napauta ⋯ kieltä, tummaa tilaa ja omia aikoja varten.', 'Takaisin laskuriin'],
  is: ['Ræstu klukkuna þegar eggið fer í sjóðandi vatn.', 'Hæð yfir sjávarmáli', 'Sýður við {t} °C', '{p} % lengri tími',
    'Lítið egg', 'Miðlungs egg', 'Stórt egg', 'Linsoðið', 'Mjúkt', 'Harðsoðið',
    'Ræsa', 'klukku', 'Hætta við', 'Stöðva vekjara',
    'Dragðu á skjánum til að velta egginu.', 'Hallaðu símanum til að velta egginu.', 'Ýttu á eggið til að byrja.',
    'Eggið er tilbúið! Taktu það upp og skolaðu í köldu vatni.', '{n} egg safnað', 'bónus', 'högg', 'röð',
    'Stillingar', 'Útlit', 'Kerfi', 'Ljóst', 'Dökkt', 'Tungumál',
    'Mín gildi', 'Þínir tímar fyrir miðlungs egg beint úr ísskápnum í sjóðandi vatn, þar sem þú býrð. Lítil og stór egg og önnur hæð eru reiknuð út frá þessu.', 'Hæð þar sem þú býrð', 'Endurstilla',
    'Eggjastærðir', 'Lítið: undir 53 g', 'Miðlungs: 53–63 g', 'Stórt: yfir 63 g', 'Tímarnir eiga við egg beint úr ísskápnum, sett í sjóðandi vatn.', 'Lab (fyrir forritara)', 'Loka',
    'Minna egg', 'Stærra egg', 'Mýkri rauða', 'Stífari rauða',
    'Ýttu á eggið til að ræsa klukkuna.', 'Notaðu − og + til að velja stærð eggs og rauðu.', 'Ýttu á ⋯ fyrir tungumál, dökka stillingu og þína eigin tíma.', 'Aftur í niðurtalninguna']
};

let lang = 'en';
let dict = {};

export function setLang(code) {
  lang = TABLE[code] ? code : 'en';
  const row = TABLE[lang];
  dict = Object.fromEntries(KEYS.map((k, i) => [k, row[i]]));
  document.documentElement.lang = lang;
}
export function getLang() { return lang; }

// t('collected', { n: 3 }) -> "3 eggs collected"
export function t(key, vars = {}) {
  let s = dict[key] ?? TABLE.en[KEYS.indexOf(key)] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
  return s;
}

// Numbers with the language's own decimal sign (95,2 or 95.2)
export function num(x, digits = 1) {
  try { return new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x); } catch (e) { return x.toFixed(digits); }
}

// Check: every language has every key
for (const [code, row] of Object.entries(TABLE)) if (row.length !== KEYS.length) console.warn('i18n: wrong number of strings for', code, row.length, KEYS.length);

setLang('en');
