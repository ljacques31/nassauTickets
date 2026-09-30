// Áudio das chamadas: um aviso sonoro curto seguido da fala em português (Web Speech API).
// Não depende de internet nem de serviços pagos.

const NOMES_FALADOS = {
  SP: 'Senha prioritária',
  SE: 'Senha de retirada de exames',
  SG: 'Senha geral',
};

const DIGITOS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

let contextoAudio = null;
let fila = Promise.resolve();

/** Precisa ser chamado a partir de um clique: navegadores bloqueiam som sem interação. */
export function liberarAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (Ctx && !contextoAudio) contextoAudio = new Ctx();
  contextoAudio?.resume?.();
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
  return audioDisponivel();
}

export function audioDisponivel() {
  return 'speechSynthesis' in window;
}

function tocarAviso(ultimaChamada) {
  if (!contextoAudio) return Promise.resolve();
  const notas = ultimaChamada ? [784, 659, 784, 659] : [659, 988];
  const inicio = contextoAudio.currentTime + 0.05;
  notas.forEach((freq, i) => {
    const osc = contextoAudio.createOscillator();
    const ganho = contextoAudio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = inicio + i * 0.28;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(ganho).connect(contextoAudio.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
  return new Promise((r) => setTimeout(r, notas.length * 280 + 150));
}

/** "Senha prioritária, S P, zero zero quatro. Guichê 3." */
export function textoDaChamada({ codigo, tipo, guiche, ultimaChamada }) {
  const numero = codigo.slice(-3).split('').map((d) => DIGITOS[Number(d)]).join(' ');
  const letras = tipo.split('').join(' ');
  const inicio = ultimaChamada ? 'Última chamada. ' : '';
  return `${inicio}${NOMES_FALADOS[tipo]}, ${letras}, ${numero}. Guichê ${guiche}.`;
}

function falar(texto) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.rate = 0.92;
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'));
    if (voz) u.voice = voz;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
    setTimeout(resolve, 12000); // garantia caso o navegador não dispare onend
  });
}

/** Anuncia uma chamada. Chamadas simultâneas entram em fila e são faladas uma de cada vez. */
export function anunciar(chamada) {
  fila = fila.then(async () => {
    await tocarAviso(chamada.ultimaChamada);
    await falar(textoDaChamada(chamada));
    if (chamada.ultimaChamada) await falar(textoDaChamada(chamada));
  });
  return fila;
}
