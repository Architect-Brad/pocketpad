// PocketPad Intelli — HTML/CSS Language Analyzer
import { LanguageAnalyzer, CompletionItem, patternDiagnostics } from './base.js';

const HTML_TAGS = [
  'a','abbr','address','area','article','aside','audio','b','base','bdi','bdo',
  'blockquote','body','br','button','canvas','caption','cite','code','col',
  'colgroup','data','datalist','dd','del','details','dfn','dialog','div','dl',
  'dt','em','embed','fieldset','figcaption','figure','footer','form','h1','h2',
  'h3','h4','h5','h6','head','header','hr','html','i','iframe','img','input',
  'ins','kbd','label','legend','li','link','main','map','mark','meta','meter',
  'nav','noscript','object','ol','optgroup','option','output','p','param',
  'picture','pre','progress','q','rp','rt','ruby','s','samp','script','section',
  'select','small','source','span','strong','style','sub','summary','sup',
  'table','tbody','td','template','textarea','tfoot','th','thead','time','title',
  'tr','track','u','ul','var','video','wbr',
];

const HTML_ATTRS = [
  'accept','action','alt','async','autocomplete','autofocus','autoplay',
  'charset','checked','cite','class','cols','colspan','content','contenteditable',
  'controls','coords','crossorigin','data','datetime','default','defer','dir',
  'disabled','download','draggable','enctype','enterkeyhint','for','form',
  'formaction','headers','height','hidden','href','hreflang','id','inputmode',
  'integrity','is','ismap','itemprop','kind','label','lang','list','loop',
  'low','max','maxlength','media','method','min','minlength','multiple',
  'muted','name','nomodule','nonce','novalidate','open','optimum','pattern',
  'placeholder','playsinline','poster','preload','profile','radiogroup',
  'readonly','referrerpolicy','rel','required','reversed','role','rows',
  'rowspan','sandbox','scope','scoped','seamless','selected','shape','size',
  'sizes','slot','span','spellcheck','src','srcdoc','srclang','srcset',
  'start','step','style','tabindex','target','title','translate','type',
  'usemap','value','width','wrap',
];

const CSS_PROPS = [
  'align-content','align-items','align-self','all','animation','animation-delay',
  'animation-direction','animation-duration','animation-fill-mode','animation-iteration-count',
  'animation-name','animation-play-state','animation-timing-function','backface-visibility',
  'background','background-attachment','background-clip','background-color',
  'background-image','background-origin','background-position','background-repeat',
  'background-size','border','border-bottom','border-bottom-color','border-bottom-left-radius',
  'border-bottom-right-radius','border-bottom-style','border-bottom-width','border-collapse',
  'border-color','border-image','border-image-outset','border-image-repeat',
  'border-image-slice','border-image-source','border-image-width','border-left',
  'border-left-color','border-left-style','border-left-width','border-radius',
  'border-right','border-right-color','border-right-style','border-right-width',
  'border-spacing','border-style','border-top','border-top-color','border-top-left-radius',
  'border-top-right-radius','border-top-style','border-top-width','border-width',
  'bottom','box-decoration-break','box-shadow','box-sizing','break-after',
  'break-before','break-inside','caption-side','clear','clip','color',
  'column-count','column-fill','column-gap','column-rule','column-rule-color',
  'column-rule-style','column-rule-width','column-span','column-width','columns',
  'content','counter-increment','counter-reset','cursor','direction','display',
  'empty-cells','filter','flex','flex-basis','flex-direction','flex-flow',
  'flex-grow','flex-shrink','flex-wrap','float','font','font-family','font-feature-settings',
  'font-kerning','font-size','font-size-adjust','font-stretch','font-style',
  'font-variant','font-variant-ligatures','font-weight','grid','grid-area',
  'grid-auto-columns','grid-auto-flow','grid-auto-rows','grid-column',
  'grid-column-end','grid-column-gap','grid-column-start','grid-gap','grid-row',
  'grid-row-end','grid-row-gap','grid-row-start','grid-template','grid-template-areas',
  'grid-template-columns','grid-template-rows','height','hyphens','ime-mode',
  'justify-content','justify-items','justify-self','left','letter-spacing',
  'line-height','list-style','list-style-image','list-style-position','list-style-type',
  'margin','margin-bottom','margin-left','margin-right','margin-top','marks',
  'max-height','max-width','min-height','min-width','mix-blend-mode',
  'object-fit','object-position','opacity','order','orphans','outline',
  'outline-color','outline-offset','outline-style','outline-width','overflow',
  'overflow-wrap','overflow-x','overflow-y','padding','padding-bottom','padding-left',
  'padding-right','padding-top','page-break-after','page-break-before','page-break-inside',
  'perspective','pointer-events','position','quotes','resize','right',
  'scroll-behavior','tab-size','table-layout','text-align','text-align-last',
  'text-decoration','text-decoration-color','text-decoration-line','text-decoration-style',
  'text-indent','text-justify','text-overflow','text-shadow','text-transform',
  'top','transform','transform-origin','transform-style','transition',
  'transition-delay','transition-duration','transition-property','transition-timing-function',
  'unicode-bidi','user-select','vertical-align','visibility','voice-balance',
  'voice-duration','voice-family','voice-pitch','voice-range','voice-rate',
  'voice-stress','voice-volume','white-space','widows','width','word-break',
  'word-spacing','word-wrap','writing-mode','z-index',
];

const CSS_VALUES = [
  'auto','inherit','initial','unset','revert','none','normal','bold','italic',
  'center','left','right','top','bottom','block','inline','flex','grid',
  'absolute','relative','fixed','sticky','static','solid','dashed','dotted',
  'hidden','visible','scroll','wrap','nowrap','cover','contain',
  'important','!important',
];

const CSS_SNIPPETS = [
  { prefix: 'display', name: 'display', body: 'display: ${1:flex};' },
  { prefix: 'position', name: 'position', body: 'position: ${1:relative};' },
  { prefix: 'width', name: 'width', body: 'width: ${1:100%};' },
  { prefix: 'height', name: 'height', body: 'height: ${1:100%};' },
  { prefix: 'margin', name: 'margin', body: 'margin: ${1:0};' },
  { prefix: 'padding', name: 'padding', body: 'padding: ${1:0};' },
  { prefix: 'color', name: 'color', body: 'color: ${1:#333};' },
  { prefix: 'bg', name: 'background-color', body: 'background-color: ${1:#fff};' },
  { prefix: 'font', name: 'font-size', body: 'font-size: ${1:16px};' },
  { prefix: 'flex', name: 'flex', body: 'display: flex;\nalign-items: ${1:center};\njustify-content: ${2:center};' },
  { prefix: 'grid', name: 'grid', body: 'display: grid;\ngrid-template-columns: ${1:repeat(3, 1fr)};\ngap: ${2:16px};' },
  { prefix: 'abs', name: 'absolute center', body: 'position: absolute;\ntop: 50%;\nleft: 50%;\ntransform: translate(-50%, -50%);' },
  { prefix: 'media', name: 'media query', body: '@media (${1:max-width: 768px}) {\n\t${2}\n}' },
  { prefix: 'hover', name: ':hover', body: '&:hover {\n\t${1}\n}' },
  { prefix: 'focus', name: ':focus', body: '&:focus {\n\t${1}\n}' },
  { prefix: 'transition', name: 'transition', body: 'transition: ${1:all 0.3s ease};' },
  { prefix: 'shadow', name: 'box-shadow', body: 'box-shadow: ${1:0 2px 4px rgba(0,0,0,0.1)};' },
  { prefix: 'border', name: 'border', body: 'border: ${1:1px solid #ddd};' },
  { prefix: 'radius', name: 'border-radius', body: 'border-radius: ${1:8px};' },
  { prefix: 'overflow', name: 'overflow', body: 'overflow: ${1:hidden};' },
  { prefix: 'text', name: 'text-align', body: 'text-align: ${1:center};' },
  { prefix: 'whitespace', name: 'white-space', body: 'white-space: ${1:nowrap};' },
  { prefix: 'truncate', name: 'text overflow', body: 'overflow: hidden;\ntext-overflow: ellipsis;\nwhite-space: nowrap;' },
  { prefix: 'cursor', name: 'cursor', body: 'cursor: ${1:pointer};' },
  { prefix: 'z', name: 'z-index', body: 'z-index: ${1:100};' },
  { prefix: 'opacity', name: 'opacity', body: 'opacity: ${1:1};' },
  { prefix: 'gap', name: 'gap', body: 'gap: ${1:16px};' },
  { prefix: 'animation', name: 'animation', body: 'animation: ${1:name} ${2:0.3s} ${3:ease} ${4:forwards};' },
];

const HTML_SNIPPETS = [
  { prefix: 'html5', name: 'HTML5 boilerplate', body: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n</head>\n<body>\n\t${2}\n</body>\n</html>' },
  { prefix: 'div', name: 'div', body: '<div class="${1}">${2}</div>' },
  { prefix: 'a', name: 'anchor', body: '<a href="${1:#}">${2:link}</a>' },
  { prefix: 'img', name: 'image', body: '<img src="${1}" alt="${2:alt text}" />' },
  { prefix: 'ul', name: 'unordered list', body: '<ul>\n\t<li>${1}</li>\n</ul>' },
  { prefix: 'ol', name: 'ordered list', body: '<ol>\n\t<li>${1}</li>\n</ol>' },
  { prefix: 'form', name: 'form', body: '<form action="${1}" method="${2:POST}">\n\t${3}\n</form>' },
  { prefix: 'input', name: 'input', body: '<input type="${1:text}" name="${2}" placeholder="${3}" />' },
  { prefix: 'btn', name: 'button', body: '<button type="${1:button}">${2:Click me}</button>' },
  { prefix: 'table', name: 'table', body: '<table>\n\t<thead>\n\t\t<tr><th>${1}</th></tr>\n\t</thead>\n\t<tbody>\n\t\t<tr><td>${2}</td></tr>\n\t</tbody>\n</table>' },
  { prefix: 'nav', name: 'nav', body: '<nav>\n\t${1}\n</nav>' },
  { prefix: 'header', name: 'header', body: '<header>\n\t${1}\n</header>' },
  { prefix: 'footer', name: 'footer', body: '<footer>\n\t${1}\n</footer>' },
  { prefix: 'main', name: 'main', body: '<main>\n\t${1}\n</main>' },
  { prefix: 'section', name: 'section', body: '<section>\n\t${1}\n</section>' },
  { prefix: 'article', name: 'article', body: '<article>\n\t${1}\n</article>' },
  { prefix: 'script', name: 'script', body: '<script src="${1}"><\/script>' },
  { prefix: 'style', name: 'style tag', body: '<style>\n\t${1}\n</style>' },
  { prefix: 'link', name: 'stylesheet link', body: '<link rel="stylesheet" href="${1}">' },
  { prefix: 'meta', name: 'meta', body: '<meta name="${1}" content="${2}">' },
];

const HTML_DIAGNOSTIC_RULES = [
  { pattern: /<img[^>]*(?!alt=)[^>]*>/, severity: 'hint', message: () => 'Images should have an alt attribute for accessibility', source: 'intelli' },
  { pattern: /<a\s+href=["']javascript:/, severity: 'error', message: () => 'Avoid javascript: URLs — use event handlers instead', source: 'intelli' },
  { pattern: /<style\b[^>]*>/, severity: 'hint', message: () => 'Consider using external stylesheets for maintainability', source: 'intelli' },
];

const CSS_DIAGNOSTIC_RULES = [
  { pattern: /!important/, severity: 'hint', message: () => 'Avoid !important — it makes CSS harder to override', source: 'intelli' },
  { pattern: /#[0-9a-fA-F]{6}/, severity: 'hint', message: () => 'Consider using CSS variables for colors', source: 'intelli' },
];

class HTMLAnalyzer extends LanguageAnalyzer {
  constructor() {
    super({ id: 'html', name: 'HTML', extensions: ['.html', '.htm', '.vue', '.svelte'] });
  }
  getKeywords() { return HTML_TAGS; }
  getBuiltins() { return []; }

  getCompletions(content, position, language) {
    const prefix = this._getPrefix(content, position);
    const pl = prefix.toLowerCase();
    const items = [];

    for (const s of HTML_SNIPPETS) {
      if (s.prefix.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(s.prefix, 'snippet', { detail: s.name, insertText: s.body, sortOrder: 0, source: 'snippet' }));
      }
    }

    for (const tag of HTML_TAGS) {
      if (tag.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(tag, 'keyword', { detail: `<${tag}>`, sortOrder: 10, source: 'keyword' }));
      }
    }

    return items;
  }

  _getPrefix(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/[a-zA-Z][a-zA-Z0-9]*$/);
    return m ? m[0] : '';
  }

  getHover(content, position, language) {
    const token = this._getTokenAt(content, position);
    if (!token) return null;
    const tag = HTML_TAGS.find(t => t === token);
    if (tag) {
      return { contents: [{ language: 'html', value: `<${tag}>` }, `HTML ${tag} element`] };
    }
    return null;
  }

  getDiagnostics(content, language) { return patternDiagnostics(content, HTML_DIAGNOSTIC_RULES); }

  _getTokenAt(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/[a-zA-Z][a-zA-Z0-9]*$/);
    return m ? m[0] : '';
  }
}

class CSSAnalyzer extends LanguageAnalyzer {
  constructor() {
    super({ id: 'css', name: 'CSS', extensions: ['.css', '.scss', '.less'] });
  }
  getKeywords() { return CSS_PROPS; }
  getBuiltins() { return []; }

  getCompletions(content, position, language) {
    const prefix = this._getPrefix(content, position);
    const pl = prefix.toLowerCase();
    const items = [];

    for (const s of CSS_SNIPPETS) {
      if (s.prefix.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(s.prefix, 'snippet', { detail: s.name, insertText: s.body, sortOrder: 0, source: 'snippet' }));
      }
    }

    for (const prop of CSS_PROPS) {
      if (prop.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(prop, 'property', { detail: 'CSS property', sortOrder: 10, source: 'keyword' }));
      }
    }

    for (const val of CSS_VALUES) {
      if (val.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(val, 'variable', { detail: 'CSS value', sortOrder: 20, source: 'builtin' }));
      }
    }

    return items;
  }

  _getPrefix(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/[a-zA-Z-][a-zA-Z0-9-]*$/);
    return m ? m[0] : '';
  }

  getDiagnostics(content, language) { return patternDiagnostics(content, CSS_DIAGNOSTIC_RULES); }
}

export { HTMLAnalyzer, CSSAnalyzer };
