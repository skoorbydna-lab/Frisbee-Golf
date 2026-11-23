from pathlib import Path
root = Path(__file__).parent
html = (root/'src/game.html').read_text()
eng = (root/'src/engine.js').read_text()
(root/'index.html').write_text(html.replace('/*ENGINE*/', eng))
print('built', len(html)+len(eng))
