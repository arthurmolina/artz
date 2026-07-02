# artz

Página de apresentação de coisas que fiz — com um easter egg: aperte a barra de
**espaço** (ou clique em **Jogar**) para jogar o **Molina Runner**, um mini jogo
2D estilo endless runner.

## O jogo

- **Espaço / ↑ / toque na tela** — pular (segure para pular mais alto)
- **↓** — abaixar (passa por baixo dos e-mails voadores ✉️)
- **Esc** — fechar o jogo
- Fuja dos bugs 🐛, aliens 👾 e incidentes em produção 🔥. A velocidade aumenta
  com o tempo e o recorde fica salvo no navegador.

## Estrutura

- `index.html` — página de apresentação + overlay do jogo
- `assets/game.js` — o jogo (canvas 2D, vanilla JS, sem dependências)
- `assets/sprites/sheet_original.png` — sprite sheet original do personagem
- `assets/sprites/frame_*.png` — frames recortados com fundo transparente
- `assets/video/running.mp4` — vídeo do personagem correndo (tela inicial do jogo)

Para rodar localmente:

```sh
python3 -m http.server 8000
# abra http://localhost:8000
```
