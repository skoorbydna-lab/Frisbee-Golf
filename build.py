# Rebuilds index.html from src/game.html + src/core.js (core is inlined so the game is one file).
import pathlib
root = pathlib.Path(__file__).parent
html = (root/'src/game.html').read_text()
core = (root/'src/core.js').read_text()
(root/'index.html').write_text(html.replace('/*CORE*/', core))
print('index.html rebuilt')
