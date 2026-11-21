import siteConfig from "../../site.config";

export type Locale = "en" | "es" | "pt" | "de" | "ja";

export type LocalizedHome = {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  lead: string;
  download: string;
  styles: string;
  benefits: { title: string; copy: string }[];
  sectionTitle: string;
  sectionLead: string;
  note: string;
  languageName: string;
};

export const localizedHome: Record<Exclude<Locale, "en">, LocalizedHome> = {
  es: {
    title: "Lyrica — Letras sincronizadas para Windows",
    description:
      "Lyrica muestra las letras sincronizadas de Spotify, Apple Music y Cider en estilos animados sobre tu escritorio de Windows. Gratis durante la beta; se necesita Discord para descargar.",
    eyebrow: "Aplicación para Windows",
    heading: "Cada estilo, antes de instalarlo.",
    lead:
      "Lyrica pone la letra en pantalla al ritmo de la música. Prueba los estilos animados aquí, elige el que encaje y deja que viva en la bandeja del sistema.",
    download: "Descargar para Windows",
    styles: "Ver todos los estilos",
    benefits: [
      { title: "Sin cuenta en la app", copy: "La aplicación no pide cuenta ni contraseña. Solo el sitio usa Discord para entregar el instalador y una clave gratuita." },
      { title: "Cualquier reproductor de Windows", copy: "Lee la sesión multimedia que Windows ya expone: Spotify, Apple Music, Cider, VLC o el navegador." },
      { title: "Tus colores, tu pantalla", copy: "Un estilo por monitor, un desplazamiento fino y los colores del disco en los textos." },
    ],
    sectionTitle: "La misma aplicación, en tu idioma.",
    sectionLead:
      "Esta página está traducida para presentar el producto. La documentación y la interfaz de la aplicación están en inglés por ahora.",
    note:
      "Traducción automática. Si algo suena raro, la versión en inglés es la de referencia. La descarga, la clave y los términos no cambian según el idioma.",
    languageName: "Español",
  },
  pt: {
    title: "Lyrica — Letras sincronizadas para Windows",
    description:
      "O Lyrica mostra letras sincronizadas do Spotify, Apple Music e Cider em estilos animados na área de trabalho do Windows. Grátis na beta; é preciso Discord para baixar.",
    eyebrow: "Aplicativo para Windows",
    heading: "Veja cada estilo antes de instalar.",
    lead:
      "O Lyrica coloca a letra na tela no ritmo da música. Teste os estilos animados aqui, escolha o que combina e deixe o aplicativo na bandeja do sistema.",
    download: "Baixar para Windows",
    styles: "Ver todos os estilos",
    benefits: [
      { title: "Sem conta no aplicativo", copy: "O app não pede conta nem senha. Só o site usa Discord para liberar o instalador e uma chave gratuita." },
      { title: "Qualquer player do Windows", copy: "Lê a sessão de mídia que o Windows já expõe: Spotify, Apple Music, Cider, VLC ou o navegador." },
      { title: "Suas cores, sua tela", copy: "Um estilo por monitor, ajuste fino de atraso e as cores da capa nos textos." },
    ],
    sectionTitle: "O mesmo aplicativo, no seu idioma.",
    sectionLead:
      "Esta página foi traduzida para apresentar o produto. A documentação e a interface do aplicativo seguem em inglês por enquanto.",
    note:
      "Tradução automática. Se algo soar estranho, a versão em inglês é a referência. Download, chave e termos não mudam com o idioma.",
    languageName: "Português",
  },
  de: {
    title: "Lyrica — Synchronisierte Songtexte für Windows",
    description:
      "Lyrica zeigt synchronisierte Songtexte von Spotify, Apple Music und Cider in animierten Stilen auf dem Windows-Desktop. In der Beta kostenlos; für den Download ist Discord nötig.",
    eyebrow: "Windows-Tray-App",
    heading: "Jeden Stil sehen, bevor du installierst.",
    lead:
      "Lyrica legt den Text im Takt der Musik auf den Bildschirm. Probiere die animierten Stile hier aus, wähle deinen Favoriten und lass die App im Infobereich wohnen.",
    download: "Für Windows herunterladen",
    styles: "Alle Stile ansehen",
    benefits: [
      { title: "Kein Konto in der App", copy: "Die App fragt weder nach Konto noch Passwort. Nur die Website nutzt Discord für Installer und einen kostenlosen Schlüssel." },
      { title: "Jeder Windows-Player", copy: "Gelesen wird die Mediensitzung, die Windows ohnehin bereitstellt: Spotify, Apple Music, Cider, VLC oder der Browser." },
      { title: "Deine Farben, dein Bildschirm", copy: "Ein Stil pro Monitor, Feinjustierung der Timing-Abweichung und die Farben des Covers in den Texten." },
    ],
    sectionTitle: "Dieselbe App, in deiner Sprache.",
    sectionLead:
      "Diese Seite ist als Produktvorstellung übersetzt. Dokumentation und App-Oberfläche sind vorerst auf Englisch.",
    note:
      "Maschinelle Übersetzung. Wenn etwas seltsam klingt, gilt die englische Fassung. Download, Schlüssel und Bedingungen ändern sich nicht mit der Sprache.",
    languageName: "Deutsch",
  },
  ja: {
    title: "Lyrica — Windows 向けの同期歌詞",
    description:
      "Lyrica は Spotify、Apple Music、Cider の歌詞を Windows デスクトップにアニメーション表示します。ベータ期間中は無料、ダウンロードには Discord が必要です。",
    eyebrow: "Windows トレイアプリ",
    heading: "インストール前に、すべてのスタイルを見る。",
    lead:
      "Lyrica は曲に合わせて歌詞を画面に表示します。ここでアニメーション スタイルを試し、気に入ったものを選んで、タスクトレイに置いておけます。",
    download: "Windows 版をダウンロード",
    styles: "すべてのスタイルを見る",
    benefits: [
      { title: "アプリにアカウント不要", copy: "アプリはアカウントもパスワードも求めません。Discord を使うのは、インストーラーと無料キーを配布するこのサイトだけです。" },
      { title: "Windows のどのプレイヤーでも", copy: "Windows が公開しているメディア セッションを読み取ります。Spotify、Apple Music、Cider、VLC、ブラウザーに対応。" },
      { title: "色も画面も自由に", copy: "モニターごとにスタイルを設定し、タイミングを微調整。ジャケットの色が歌詞に反映されます。" },
    ],
    sectionTitle: "同じアプリを、あなたの言語で。",
    sectionLead:
      "このページは製品紹介として翻訳されています。ドキュメントとアプリの画面は、当面は英語のみです。",
    note:
      "機械翻訳です。不自然な箇所は英語版を正とします。ダウンロード、キー、規約は言語によって変わりません。",
    languageName: "日本語",
  },
};

export const localeCodes = siteConfig.i18n.locales.map((locale) => locale.code) as Locale[];
