/* ACERFIX · one fail-closed display adapter for calendar glass.
   Child rows render an allowlisted title only. Provider, clinical, and therapy items are always omitted. There is no opt-in.
   Titles never come from description, hint, location, notes, or a sliced raw sentence.
   Ainsley's own audience keeps the no-digit rule. The shared hub reads canonical startIso instead. */
(function (global) {
  "use strict";
  var TZ = "America/Chicago";
  /* Stems stay open at the end: "therapy" / "psychology" / "psychiatry" are denied, not only the bare stem.
     A clinical word anywhere in the source drops the whole item. It is never renamed to Homework. */
  /* Hard clinical words drop an item for every audience. Appointment and session
     are a boys-only ban so Ainsley's and Dan's own sessions can stay. */
  var HARD = /(?:\b(?:ot|speech|drs?|doctors?|telehealth|counsel(?:or|ing|ling)?|anxiety|provider|clinical)\b|\btherap|\bpsycholog|\bpsychiatr)/i;
  var SOFT = /\b(?:appointments?|sessions?)\b/i;
  var APPT_WORD = /\b(?:appointments?|sessions?|dentists?)\b/i;
  var BOY_NAME = /\b(?:hayes|harris)\b/i;
  var CLINICAL = new RegExp(HARD.source + "|" + SOFT.source, "i");
  var SKIP_KEY = /^(id|icdId|href|url|link|htmlLink|source|tz|status|tone|cadence|theme|color|colour|cls|class|kid|owner|audience|kidId|providerOptIn|allDay|leaveBy|timeRole)$/i;
  var CANCEL = /(?:^|\b)(?:cancel+ed|cxl)\b/i;
  var RANGE = /\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*[-–—to]{1,3}\s*\d{1,2}(?::\d{2})?/i;
  var LISTS = ["today", "school", "sports", "appointments", "week", "events", "ahead", "upcoming", "hottest"];

  function textOf(v) {
    return typeof v === "string" ? v : "";
  }
  function nfkc(s) {
    try { return String(s == null ? "" : s).normalize("NFKC"); }
    catch (e) { return String(s == null ? "" : s); }
  }
  /* Look-alikes that can spell hayes or harris, mapped to Latin. */
  var LOOK = {
    "\u0410": "a", "\u0430": "a", "\u0415": "e", "\u0435": "e", "\u041E": "o", "\u043E": "o",
    "\u0420": "p", "\u0440": "p", "\u0421": "c", "\u0441": "c", "\u0423": "y", "\u0443": "y",
    "\u0425": "x", "\u0445": "x", "\u0406": "i", "\u0456": "i", "\u0408": "j", "\u0458": "j",
    "\u0405": "s", "\u0455": "s", "\u041D": "h", "\u043D": "h", "\u0412": "b", "\u0432": "b",
    "\u041A": "k", "\u043A": "k", "\u041C": "m", "\u043C": "m", "\u0422": "t", "\u0442": "t",
    "\u0391": "a", "\u03B1": "a", "\u0392": "b", "\u03B2": "b", "\u0395": "e", "\u03B5": "e",
    "\u0397": "h", "\u03B7": "h", "\u0399": "i", "\u03B9": "i", "\u039A": "k", "\u03BA": "k",
    "\u039C": "m", "\u03BC": "m", "\u039D": "n", "\u03BD": "n", "\u039F": "o", "\u03BF": "o",
    "\u03A1": "p", "\u03C1": "p", "\u03A4": "t", "\u03C4": "t", "\u03A5": "y", "\u03C5": "y",
    "\u03A7": "x", "\u03C7": "x", "\u0396": "z", "\u03B6": "z"
  };
  function nfkd(s) {
    try { return String(s == null ? "" : s).normalize("NFKD"); }
    catch (e) { return String(s == null ? "" : s); }
  }
  var ENT = {"Aacute":"Á","aacute":"á","Abreve":"Ă","abreve":"ă","ac":"∾","acd":"∿","acE":"∾̳","Acirc":"Â","acirc":"â","acute":"´","Acy":"А","acy":"а","AElig":"Æ","aelig":"æ","af":"⁡","Afr":"𝔄","afr":"𝔞","Agrave":"À","agrave":"à","alefsym":"ℵ","aleph":"ℵ","Alpha":"Α","alpha":"α","Amacr":"Ā","amacr":"ā","amalg":"⨿","AMP":"&","amp":"&","And":"⩓","and":"∧","andand":"⩕","andd":"⩜","andslope":"⩘","andv":"⩚","ang":"∠","ange":"⦤","angle":"∠","angmsd":"∡","angmsdaa":"⦨","angmsdab":"⦩","angmsdac":"⦪","angmsdad":"⦫","angmsdae":"⦬","angmsdaf":"⦭","angmsdag":"⦮","angmsdah":"⦯","angrt":"∟","angrtvb":"⊾","angrtvbd":"⦝","angsph":"∢","angst":"Å","angzarr":"⍼","Aogon":"Ą","aogon":"ą","Aopf":"𝔸","aopf":"𝕒","ap":"≈","apacir":"⩯","apE":"⩰","ape":"≊","apid":"≋","apos":"'","ApplyFunction":"⁡","approx":"≈","approxeq":"≊","Aring":"Å","aring":"å","Ascr":"𝒜","ascr":"𝒶","Assign":"≔","ast":"*","asymp":"≈","asympeq":"≍","Atilde":"Ã","atilde":"ã","Auml":"Ä","auml":"ä","awconint":"∳","awint":"⨑","backcong":"≌","backepsilon":"϶","backprime":"‵","backsim":"∽","backsimeq":"⋍","Backslash":"∖","Barv":"⫧","barvee":"⊽","Barwed":"⌆","barwed":"⌅","barwedge":"⌅","bbrk":"⎵","bbrktbrk":"⎶","bcong":"≌","Bcy":"Б","bcy":"б","bdquo":"„","becaus":"∵","Because":"∵","because":"∵","bemptyv":"⦰","bepsi":"϶","bernou":"ℬ","Bernoullis":"ℬ","Beta":"Β","beta":"β","beth":"ℶ","between":"≬","Bfr":"𝔅","bfr":"𝔟","bigcap":"⋂","bigcirc":"◯","bigcup":"⋃","bigodot":"⨀","bigoplus":"⨁","bigotimes":"⨂","bigsqcup":"⨆","bigstar":"★","bigtriangledown":"▽","bigtriangleup":"△","biguplus":"⨄","bigvee":"⋁","bigwedge":"⋀","bkarow":"⤍","blacklozenge":"⧫","blacksquare":"▪","blacktriangle":"▴","blacktriangledown":"▾","blacktriangleleft":"◂","blacktriangleright":"▸","blank":"␣","blk12":"▒","blk14":"░","blk34":"▓","block":"█","bne":"=⃥","bnequiv":"≡⃥","bNot":"⫭","bnot":"⌐","Bopf":"𝔹","bopf":"𝕓","bot":"⊥","bottom":"⊥","bowtie":"⋈","boxbox":"⧉","boxDL":"╗","boxDl":"╖","boxdL":"╕","boxdl":"┐","boxDR":"╔","boxDr":"╓","boxdR":"╒","boxdr":"┌","boxH":"═","boxh":"─","boxHD":"╦","boxHd":"╤","boxhD":"╥","boxhd":"┬","boxHU":"╩","boxHu":"╧","boxhU":"╨","boxhu":"┴","boxminus":"⊟","boxplus":"⊞","boxtimes":"⊠","boxUL":"╝","boxUl":"╜","boxuL":"╛","boxul":"┘","boxUR":"╚","boxUr":"╙","boxuR":"╘","boxur":"└","boxV":"║","boxv":"│","boxVH":"╬","boxVh":"╫","boxvH":"╪","boxvh":"┼","boxVL":"╣","boxVl":"╢","boxvL":"╡","boxvl":"┤","boxVR":"╠","boxVr":"╟","boxvR":"╞","boxvr":"├","bprime":"‵","Breve":"˘","breve":"˘","brvbar":"¦","Bscr":"ℬ","bscr":"𝒷","bsemi":"⁏","bsim":"∽","bsime":"⋍","bsol":"\\","bsolb":"⧅","bsolhsub":"⟈","bull":"•","bullet":"•","bump":"≎","bumpE":"⪮","bumpe":"≏","Bumpeq":"≎","bumpeq":"≏","Cacute":"Ć","cacute":"ć","Cap":"⋒","cap":"∩","capand":"⩄","capbrcup":"⩉","capcap":"⩋","capcup":"⩇","capdot":"⩀","CapitalDifferentialD":"ⅅ","caps":"∩︀","caret":"⁁","caron":"ˇ","Cayleys":"ℭ","ccaps":"⩍","Ccaron":"Č","ccaron":"č","Ccedil":"Ç","ccedil":"ç","Ccirc":"Ĉ","ccirc":"ĉ","Cconint":"∰","ccups":"⩌","ccupssm":"⩐","Cdot":"Ċ","cdot":"ċ","cedil":"¸","Cedilla":"¸","cemptyv":"⦲","cent":"¢","CenterDot":"·","centerdot":"·","Cfr":"ℭ","cfr":"𝔠","CHcy":"Ч","chcy":"ч","check":"✓","checkmark":"✓","Chi":"Χ","chi":"χ","cir":"○","circ":"ˆ","circeq":"≗","circlearrowleft":"↺","circlearrowright":"↻","circledast":"⊛","circledcirc":"⊚","circleddash":"⊝","CircleDot":"⊙","circledR":"®","circledS":"Ⓢ","CircleMinus":"⊖","CirclePlus":"⊕","CircleTimes":"⊗","cirE":"⧃","cire":"≗","cirfnint":"⨐","cirmid":"⫯","cirscir":"⧂","ClockwiseContourIntegral":"∲","CloseCurlyDoubleQuote":"”","CloseCurlyQuote":"’","clubs":"♣","clubsuit":"♣","Colon":"∷","colon":":","Colone":"⩴","colone":"≔","coloneq":"≔","comma":",","commat":"@","comp":"∁","compfn":"∘","complement":"∁","complexes":"ℂ","cong":"≅","congdot":"⩭","Congruent":"≡","Conint":"∯","conint":"∮","ContourIntegral":"∮","Copf":"ℂ","copf":"𝕔","coprod":"∐","Coproduct":"∐","COPY":"©","copy":"©","copysr":"℗","CounterClockwiseContourIntegral":"∳","crarr":"↵","Cross":"⨯","cross":"✗","Cscr":"𝒞","cscr":"𝒸","csub":"⫏","csube":"⫑","csup":"⫐","csupe":"⫒","ctdot":"⋯","cudarrl":"⤸","cudarrr":"⤵","cuepr":"⋞","cuesc":"⋟","cularr":"↶","cularrp":"⤽","Cup":"⋓","cup":"∪","cupbrcap":"⩈","CupCap":"≍","cupcap":"⩆","cupcup":"⩊","cupdot":"⊍","cupor":"⩅","cups":"∪︀","curarr":"↷","curarrm":"⤼","curlyeqprec":"⋞","curlyeqsucc":"⋟","curlyvee":"⋎","curlywedge":"⋏","curren":"¤","curvearrowleft":"↶","curvearrowright":"↷","cuvee":"⋎","cuwed":"⋏","cwconint":"∲","cwint":"∱","cylcty":"⌭","Dagger":"‡","dagger":"†","daleth":"ℸ","Darr":"↡","dArr":"⇓","darr":"↓","dash":"‐","Dashv":"⫤","dashv":"⊣","dbkarow":"⤏","dblac":"˝","Dcaron":"Ď","dcaron":"ď","Dcy":"Д","dcy":"д","DD":"ⅅ","dd":"ⅆ","ddagger":"‡","ddarr":"⇊","DDotrahd":"⤑","ddotseq":"⩷","deg":"°","Del":"∇","Delta":"Δ","delta":"δ","demptyv":"⦱","dfisht":"⥿","Dfr":"𝔇","dfr":"𝔡","dHar":"⥥","dharl":"⇃","dharr":"⇂","DiacriticalAcute":"´","DiacriticalDot":"˙","DiacriticalDoubleAcute":"˝","DiacriticalGrave":"`","DiacriticalTilde":"˜","diam":"⋄","Diamond":"⋄","diamond":"⋄","diamondsuit":"♦","diams":"♦","die":"¨","DifferentialD":"ⅆ","digamma":"ϝ","disin":"⋲","div":"÷","divide":"÷","divideontimes":"⋇","divonx":"⋇","DJcy":"Ђ","djcy":"ђ","dlcorn":"⌞","dlcrop":"⌍","dollar":"$","Dopf":"𝔻","dopf":"𝕕","Dot":"¨","dot":"˙","DotDot":"⃜","doteq":"≐","doteqdot":"≑","DotEqual":"≐","dotminus":"∸","dotplus":"∔","dotsquare":"⊡","doublebarwedge":"⌆","DoubleContourIntegral":"∯","DoubleDot":"¨","DoubleDownArrow":"⇓","DoubleLeftArrow":"⇐","DoubleLeftRightArrow":"⇔","DoubleLeftTee":"⫤","DoubleLongLeftArrow":"⟸","DoubleLongLeftRightArrow":"⟺","DoubleLongRightArrow":"⟹","DoubleRightArrow":"⇒","DoubleRightTee":"⊨","DoubleUpArrow":"⇑","DoubleUpDownArrow":"⇕","DoubleVerticalBar":"∥","DownArrow":"↓","Downarrow":"⇓","downarrow":"↓","DownArrowBar":"⤓","DownArrowUpArrow":"⇵","DownBreve":"̑","downdownarrows":"⇊","downharpoonleft":"⇃","downharpoonright":"⇂","DownLeftRightVector":"⥐","DownLeftTeeVector":"⥞","DownLeftVector":"↽","DownLeftVectorBar":"⥖","DownRightTeeVector":"⥟","DownRightVector":"⇁","DownRightVectorBar":"⥗","DownTee":"⊤","DownTeeArrow":"↧","drbkarow":"⤐","drcorn":"⌟","drcrop":"⌌","Dscr":"𝒟","dscr":"𝒹","DScy":"Ѕ","dscy":"ѕ","dsol":"⧶","Dstrok":"Đ","dstrok":"đ","dtdot":"⋱","dtri":"▿","dtrif":"▾","duarr":"⇵","duhar":"⥯","dwangle":"⦦","DZcy":"Џ","dzcy":"џ","dzigrarr":"⟿","Eacute":"É","eacute":"é","easter":"⩮","Ecaron":"Ě","ecaron":"ě","ecir":"≖","Ecirc":"Ê","ecirc":"ê","ecolon":"≕","Ecy":"Э","ecy":"э","eDDot":"⩷","Edot":"Ė","eDot":"≑","edot":"ė","ee":"ⅇ","efDot":"≒","Efr":"𝔈","efr":"𝔢","eg":"⪚","Egrave":"È","egrave":"è","egs":"⪖","egsdot":"⪘","el":"⪙","Element":"∈","elinters":"⏧","ell":"ℓ","els":"⪕","elsdot":"⪗","Emacr":"Ē","emacr":"ē","empty":"∅","emptyset":"∅","EmptySmallSquare":"◻","emptyv":"∅","EmptyVerySmallSquare":"▫","emsp13":" ","emsp14":" ","emsp":" ","ENG":"Ŋ","eng":"ŋ","ensp":" ","Eogon":"Ę","eogon":"ę","Eopf":"𝔼","eopf":"𝕖","epar":"⋕","eparsl":"⧣","eplus":"⩱","epsi":"ε","Epsilon":"Ε","epsilon":"ε","epsiv":"ϵ","eqcirc":"≖","eqcolon":"≕","eqsim":"≂","eqslantgtr":"⪖","eqslantless":"⪕","Equal":"⩵","equals":"=","EqualTilde":"≂","equest":"≟","Equilibrium":"⇌","equiv":"≡","equivDD":"⩸","eqvparsl":"⧥","erarr":"⥱","erDot":"≓","Escr":"ℰ","escr":"ℯ","esdot":"≐","Esim":"⩳","esim":"≂","Eta":"Η","eta":"η","ETH":"Ð","eth":"ð","Euml":"Ë","euml":"ë","euro":"€","excl":"!","exist":"∃","Exists":"∃","expectation":"ℰ","ExponentialE":"ⅇ","exponentiale":"ⅇ","fallingdotseq":"≒","Fcy":"Ф","fcy":"ф","female":"♀","ffilig":"ﬃ","fflig":"ﬀ","ffllig":"ﬄ","Ffr":"𝔉","ffr":"𝔣","filig":"ﬁ","FilledSmallSquare":"◼","FilledVerySmallSquare":"▪","fjlig":"fj","flat":"♭","fllig":"ﬂ","fltns":"▱","fnof":"ƒ","Fopf":"𝔽","fopf":"𝕗","ForAll":"∀","forall":"∀","fork":"⋔","forkv":"⫙","Fouriertrf":"ℱ","fpartint":"⨍","frac12":"½","frac13":"⅓","frac14":"¼","frac15":"⅕","frac16":"⅙","frac18":"⅛","frac23":"⅔","frac25":"⅖","frac34":"¾","frac35":"⅗","frac38":"⅜","frac45":"⅘","frac56":"⅚","frac58":"⅝","frac78":"⅞","frasl":"⁄","frown":"⌢","Fscr":"ℱ","fscr":"𝒻","gacute":"ǵ","Gamma":"Γ","gamma":"γ","Gammad":"Ϝ","gammad":"ϝ","gap":"⪆","Gbreve":"Ğ","gbreve":"ğ","Gcedil":"Ģ","Gcirc":"Ĝ","gcirc":"ĝ","Gcy":"Г","gcy":"г","Gdot":"Ġ","gdot":"ġ","gE":"≧","ge":"≥","gEl":"⪌","gel":"⋛","geq":"≥","geqq":"≧","geqslant":"⩾","ges":"⩾","gescc":"⪩","gesdot":"⪀","gesdoto":"⪂","gesdotol":"⪄","gesl":"⋛︀","gesles":"⪔","Gfr":"𝔊","gfr":"𝔤","Gg":"⋙","gg":"≫","ggg":"⋙","gimel":"ℷ","GJcy":"Ѓ","gjcy":"ѓ","gl":"≷","gla":"⪥","glE":"⪒","glj":"⪤","gnap":"⪊","gnapprox":"⪊","gnE":"≩","gne":"⪈","gneq":"⪈","gneqq":"≩","gnsim":"⋧","Gopf":"𝔾","gopf":"𝕘","grave":"`","GreaterEqual":"≥","GreaterEqualLess":"⋛","GreaterFullEqual":"≧","GreaterGreater":"⪢","GreaterLess":"≷","GreaterSlantEqual":"⩾","GreaterTilde":"≳","Gscr":"𝒢","gscr":"ℊ","gsim":"≳","gsime":"⪎","gsiml":"⪐","GT":">","Gt":"≫","gt":">","gtcc":"⪧","gtcir":"⩺","gtdot":"⋗","gtlPar":"⦕","gtquest":"⩼","gtrapprox":"⪆","gtrarr":"⥸","gtrdot":"⋗","gtreqless":"⋛","gtreqqless":"⪌","gtrless":"≷","gtrsim":"≳","gvertneqq":"≩︀","gvnE":"≩︀","Hacek":"ˇ","hairsp":" ","half":"½","hamilt":"ℋ","HARDcy":"Ъ","hardcy":"ъ","hArr":"⇔","harr":"↔","harrcir":"⥈","harrw":"↭","Hat":"^","hbar":"ℏ","Hcirc":"Ĥ","hcirc":"ĥ","hearts":"♥","heartsuit":"♥","hellip":"…","hercon":"⊹","Hfr":"ℌ","hfr":"𝔥","HilbertSpace":"ℋ","hksearow":"⤥","hkswarow":"⤦","hoarr":"⇿","homtht":"∻","hookleftarrow":"↩","hookrightarrow":"↪","Hopf":"ℍ","hopf":"𝕙","horbar":"―","HorizontalLine":"─","Hscr":"ℋ","hscr":"𝒽","hslash":"ℏ","Hstrok":"Ħ","hstrok":"ħ","HumpDownHump":"≎","HumpEqual":"≏","hybull":"⁃","hyphen":"‐","Iacute":"Í","iacute":"í","ic":"⁣","Icirc":"Î","icirc":"î","Icy":"И","icy":"и","Idot":"İ","IEcy":"Е","iecy":"е","iexcl":"¡","iff":"⇔","Ifr":"ℑ","ifr":"𝔦","Igrave":"Ì","igrave":"ì","ii":"ⅈ","iiiint":"⨌","iiint":"∭","iinfin":"⧜","iiota":"℩","IJlig":"Ĳ","ijlig":"ĳ","Im":"ℑ","Imacr":"Ī","imacr":"ī","image":"ℑ","ImaginaryI":"ⅈ","imagline":"ℐ","imagpart":"ℑ","imath":"ı","imof":"⊷","imped":"Ƶ","Implies":"⇒","in":"∈","incare":"℅","infin":"∞","infintie":"⧝","inodot":"ı","Int":"∬","int":"∫","intcal":"⊺","integers":"ℤ","Integral":"∫","intercal":"⊺","Intersection":"⋂","intlarhk":"⨗","intprod":"⨼","InvisibleComma":"⁣","InvisibleTimes":"⁢","IOcy":"Ё","iocy":"ё","Iogon":"Į","iogon":"į","Iopf":"𝕀","iopf":"𝕚","Iota":"Ι","iota":"ι","iprod":"⨼","iquest":"¿","Iscr":"ℐ","iscr":"𝒾","isin":"∈","isindot":"⋵","isinE":"⋹","isins":"⋴","isinsv":"⋳","isinv":"∈","it":"⁢","Itilde":"Ĩ","itilde":"ĩ","Iukcy":"І","iukcy":"і","Iuml":"Ï","iuml":"ï","Jcirc":"Ĵ","jcirc":"ĵ","Jcy":"Й","jcy":"й","Jfr":"𝔍","jfr":"𝔧","jmath":"ȷ","Jopf":"𝕁","jopf":"𝕛","Jscr":"𝒥","jscr":"𝒿","Jsercy":"Ј","jsercy":"ј","Jukcy":"Є","jukcy":"є","Kappa":"Κ","kappa":"κ","kappav":"ϰ","Kcedil":"Ķ","kcedil":"ķ","Kcy":"К","kcy":"к","Kfr":"𝔎","kfr":"𝔨","kgreen":"ĸ","KHcy":"Х","khcy":"х","KJcy":"Ќ","kjcy":"ќ","Kopf":"𝕂","kopf":"𝕜","Kscr":"𝒦","kscr":"𝓀","lAarr":"⇚","Lacute":"Ĺ","lacute":"ĺ","laemptyv":"⦴","lagran":"ℒ","Lambda":"Λ","lambda":"λ","Lang":"⟪","lang":"⟨","langd":"⦑","langle":"⟨","lap":"⪅","Laplacetrf":"ℒ","laquo":"«","Larr":"↞","lArr":"⇐","larr":"←","larrb":"⇤","larrbfs":"⤟","larrfs":"⤝","larrhk":"↩","larrlp":"↫","larrpl":"⤹","larrsim":"⥳","larrtl":"↢","lat":"⪫","lAtail":"⤛","latail":"⤙","late":"⪭","lates":"⪭︀","lBarr":"⤎","lbarr":"⤌","lbbrk":"❲","lbrace":"{","lbrack":"[","lbrke":"⦋","lbrksld":"⦏","lbrkslu":"⦍","Lcaron":"Ľ","lcaron":"ľ","Lcedil":"Ļ","lcedil":"ļ","lceil":"⌈","lcub":"{","Lcy":"Л","lcy":"л","ldca":"⤶","ldquo":"“","ldquor":"„","ldrdhar":"⥧","ldrushar":"⥋","ldsh":"↲","lE":"≦","le":"≤","LeftAngleBracket":"⟨","LeftArrow":"←","Leftarrow":"⇐","leftarrow":"←","LeftArrowBar":"⇤","LeftArrowRightArrow":"⇆","leftarrowtail":"↢","LeftCeiling":"⌈","LeftDoubleBracket":"⟦","LeftDownTeeVector":"⥡","LeftDownVector":"⇃","LeftDownVectorBar":"⥙","LeftFloor":"⌊","leftharpoondown":"↽","leftharpoonup":"↼","leftleftarrows":"⇇","LeftRightArrow":"↔","Leftrightarrow":"⇔","leftrightarrow":"↔","leftrightarrows":"⇆","leftrightharpoons":"⇋","leftrightsquigarrow":"↭","LeftRightVector":"⥎","LeftTee":"⊣","LeftTeeArrow":"↤","LeftTeeVector":"⥚","leftthreetimes":"⋋","LeftTriangle":"⊲","LeftTriangleBar":"⧏","LeftTriangleEqual":"⊴","LeftUpDownVector":"⥑","LeftUpTeeVector":"⥠","LeftUpVector":"↿","LeftUpVectorBar":"⥘","LeftVector":"↼","LeftVectorBar":"⥒","lEg":"⪋","leg":"⋚","leq":"≤","leqq":"≦","leqslant":"⩽","les":"⩽","lescc":"⪨","lesdot":"⩿","lesdoto":"⪁","lesdotor":"⪃","lesg":"⋚︀","lesges":"⪓","lessapprox":"⪅","lessdot":"⋖","lesseqgtr":"⋚","lesseqqgtr":"⪋","LessEqualGreater":"⋚","LessFullEqual":"≦","LessGreater":"≶","lessgtr":"≶","LessLess":"⪡","lesssim":"≲","LessSlantEqual":"⩽","LessTilde":"≲","lfisht":"⥼","lfloor":"⌊","Lfr":"𝔏","lfr":"𝔩","lg":"≶","lgE":"⪑","lHar":"⥢","lhard":"↽","lharu":"↼","lharul":"⥪","lhblk":"▄","LJcy":"Љ","ljcy":"љ","Ll":"⋘","ll":"≪","llarr":"⇇","llcorner":"⌞","Lleftarrow":"⇚","llhard":"⥫","lltri":"◺","Lmidot":"Ŀ","lmidot":"ŀ","lmoust":"⎰","lmoustache":"⎰","lnap":"⪉","lnapprox":"⪉","lnE":"≨","lne":"⪇","lneq":"⪇","lneqq":"≨","lnsim":"⋦","loang":"⟬","loarr":"⇽","lobrk":"⟦","LongLeftArrow":"⟵","Longleftarrow":"⟸","longleftarrow":"⟵","LongLeftRightArrow":"⟷","Longleftrightarrow":"⟺","longleftrightarrow":"⟷","longmapsto":"⟼","LongRightArrow":"⟶","Longrightarrow":"⟹","longrightarrow":"⟶","looparrowleft":"↫","looparrowright":"↬","lopar":"⦅","Lopf":"𝕃","lopf":"𝕝","loplus":"⨭","lotimes":"⨴","lowast":"∗","lowbar":"_","LowerLeftArrow":"↙","LowerRightArrow":"↘","loz":"◊","lozenge":"◊","lozf":"⧫","lpar":"(","lparlt":"⦓","lrarr":"⇆","lrcorner":"⌟","lrhar":"⇋","lrhard":"⥭","lrm":"‎","lrtri":"⊿","lsaquo":"‹","Lscr":"ℒ","lscr":"𝓁","Lsh":"↰","lsh":"↰","lsim":"≲","lsime":"⪍","lsimg":"⪏","lsqb":"[","lsquo":"‘","lsquor":"‚","Lstrok":"Ł","lstrok":"ł","LT":"<","Lt":"≪","lt":"<","ltcc":"⪦","ltcir":"⩹","ltdot":"⋖","lthree":"⋋","ltimes":"⋉","ltlarr":"⥶","ltquest":"⩻","ltri":"◃","ltrie":"⊴","ltrif":"◂","ltrPar":"⦖","lurdshar":"⥊","luruhar":"⥦","lvertneqq":"≨︀","lvnE":"≨︀","macr":"¯","male":"♂","malt":"✠","maltese":"✠","Map":"⤅","map":"↦","mapsto":"↦","mapstodown":"↧","mapstoleft":"↤","mapstoup":"↥","marker":"▮","mcomma":"⨩","Mcy":"М","mcy":"м","mdash":"—","mDDot":"∺","measuredangle":"∡","MediumSpace":" ","Mellintrf":"ℳ","Mfr":"𝔐","mfr":"𝔪","mho":"℧","micro":"µ","mid":"∣","midast":"*","midcir":"⫰","middot":"·","minus":"−","minusb":"⊟","minusd":"∸","minusdu":"⨪","MinusPlus":"∓","mlcp":"⫛","mldr":"…","mnplus":"∓","models":"⊧","Mopf":"𝕄","mopf":"𝕞","mp":"∓","Mscr":"ℳ","mscr":"𝓂","mstpos":"∾","Mu":"Μ","mu":"μ","multimap":"⊸","mumap":"⊸","nabla":"∇","Nacute":"Ń","nacute":"ń","nang":"∠⃒","nap":"≉","napE":"⩰̸","napid":"≋̸","napos":"ŉ","napprox":"≉","natur":"♮","natural":"♮","naturals":"ℕ","nbsp":" ","nbump":"≎̸","nbumpe":"≏̸","ncap":"⩃","Ncaron":"Ň","ncaron":"ň","Ncedil":"Ņ","ncedil":"ņ","ncong":"≇","ncongdot":"⩭̸","ncup":"⩂","Ncy":"Н","ncy":"н","ndash":"–","ne":"≠","nearhk":"⤤","neArr":"⇗","nearr":"↗","nearrow":"↗","nedot":"≐̸","NegativeMediumSpace":"​","NegativeThickSpace":"​","NegativeThinSpace":"​","NegativeVeryThinSpace":"​","nequiv":"≢","nesear":"⤨","nesim":"≂̸","NestedGreaterGreater":"≫","NestedLessLess":"≪","NewLine":"\n","nexist":"∄","nexists":"∄","Nfr":"𝔑","nfr":"𝔫","ngE":"≧̸","nge":"≱","ngeq":"≱","ngeqq":"≧̸","ngeqslant":"⩾̸","nges":"⩾̸","nGg":"⋙̸","ngsim":"≵","nGt":"≫⃒","ngt":"≯","ngtr":"≯","nGtv":"≫̸","nhArr":"⇎","nharr":"↮","nhpar":"⫲","ni":"∋","nis":"⋼","nisd":"⋺","niv":"∋","NJcy":"Њ","njcy":"њ","nlArr":"⇍","nlarr":"↚","nldr":"‥","nlE":"≦̸","nle":"≰","nLeftarrow":"⇍","nleftarrow":"↚","nLeftrightarrow":"⇎","nleftrightarrow":"↮","nleq":"≰","nleqq":"≦̸","nleqslant":"⩽̸","nles":"⩽̸","nless":"≮","nLl":"⋘̸","nlsim":"≴","nLt":"≪⃒","nlt":"≮","nltri":"⋪","nltrie":"⋬","nLtv":"≪̸","nmid":"∤","NoBreak":"⁠","NonBreakingSpace":" ","Nopf":"ℕ","nopf":"𝕟","Not":"⫬","not":"¬","NotCongruent":"≢","NotCupCap":"≭","NotDoubleVerticalBar":"∦","NotElement":"∉","NotEqual":"≠","NotEqualTilde":"≂̸","NotExists":"∄","NotGreater":"≯","NotGreaterEqual":"≱","NotGreaterFullEqual":"≧̸","NotGreaterGreater":"≫̸","NotGreaterLess":"≹","NotGreaterSlantEqual":"⩾̸","NotGreaterTilde":"≵","NotHumpDownHump":"≎̸","NotHumpEqual":"≏̸","notin":"∉","notindot":"⋵̸","notinE":"⋹̸","notinva":"∉","notinvb":"⋷","notinvc":"⋶","NotLeftTriangle":"⋪","NotLeftTriangleBar":"⧏̸","NotLeftTriangleEqual":"⋬","NotLess":"≮","NotLessEqual":"≰","NotLessGreater":"≸","NotLessLess":"≪̸","NotLessSlantEqual":"⩽̸","NotLessTilde":"≴","NotNestedGreaterGreater":"⪢̸","NotNestedLessLess":"⪡̸","notni":"∌","notniva":"∌","notnivb":"⋾","notnivc":"⋽","NotPrecedes":"⊀","NotPrecedesEqual":"⪯̸","NotPrecedesSlantEqual":"⋠","NotReverseElement":"∌","NotRightTriangle":"⋫","NotRightTriangleBar":"⧐̸","NotRightTriangleEqual":"⋭","NotSquareSubset":"⊏̸","NotSquareSubsetEqual":"⋢","NotSquareSuperset":"⊐̸","NotSquareSupersetEqual":"⋣","NotSubset":"⊂⃒","NotSubsetEqual":"⊈","NotSucceeds":"⊁","NotSucceedsEqual":"⪰̸","NotSucceedsSlantEqual":"⋡","NotSucceedsTilde":"≿̸","NotSuperset":"⊃⃒","NotSupersetEqual":"⊉","NotTilde":"≁","NotTildeEqual":"≄","NotTildeFullEqual":"≇","NotTildeTilde":"≉","NotVerticalBar":"∤","npar":"∦","nparallel":"∦","nparsl":"⫽⃥","npart":"∂̸","npolint":"⨔","npr":"⊀","nprcue":"⋠","npre":"⪯̸","nprec":"⊀","npreceq":"⪯̸","nrArr":"⇏","nrarr":"↛","nrarrc":"⤳̸","nrarrw":"↝̸","nRightarrow":"⇏","nrightarrow":"↛","nrtri":"⋫","nrtrie":"⋭","nsc":"⊁","nsccue":"⋡","nsce":"⪰̸","Nscr":"𝒩","nscr":"𝓃","nshortmid":"∤","nshortparallel":"∦","nsim":"≁","nsime":"≄","nsimeq":"≄","nsmid":"∤","nspar":"∦","nsqsube":"⋢","nsqsupe":"⋣","nsub":"⊄","nsubE":"⫅̸","nsube":"⊈","nsubset":"⊂⃒","nsubseteq":"⊈","nsubseteqq":"⫅̸","nsucc":"⊁","nsucceq":"⪰̸","nsup":"⊅","nsupE":"⫆̸","nsupe":"⊉","nsupset":"⊃⃒","nsupseteq":"⊉","nsupseteqq":"⫆̸","ntgl":"≹","Ntilde":"Ñ","ntilde":"ñ","ntlg":"≸","ntriangleleft":"⋪","ntrianglelefteq":"⋬","ntriangleright":"⋫","ntrianglerighteq":"⋭","Nu":"Ν","nu":"ν","num":"#","numero":"№","numsp":" ","nvap":"≍⃒","nVDash":"⊯","nVdash":"⊮","nvDash":"⊭","nvdash":"⊬","nvge":"≥⃒","nvgt":">⃒","nvHarr":"⤄","nvinfin":"⧞","nvlArr":"⤂","nvle":"≤⃒","nvlt":"<⃒","nvltrie":"⊴⃒","nvrArr":"⤃","nvrtrie":"⊵⃒","nvsim":"∼⃒","nwarhk":"⤣","nwArr":"⇖","nwarr":"↖","nwarrow":"↖","nwnear":"⤧","Oacute":"Ó","oacute":"ó","oast":"⊛","ocir":"⊚","Ocirc":"Ô","ocirc":"ô","Ocy":"О","ocy":"о","odash":"⊝","Odblac":"Ő","odblac":"ő","odiv":"⨸","odot":"⊙","odsold":"⦼","OElig":"Œ","oelig":"œ","ofcir":"⦿","Ofr":"𝔒","ofr":"𝔬","ogon":"˛","Ograve":"Ò","ograve":"ò","ogt":"⧁","ohbar":"⦵","ohm":"Ω","oint":"∮","olarr":"↺","olcir":"⦾","olcross":"⦻","oline":"‾","olt":"⧀","Omacr":"Ō","omacr":"ō","Omega":"Ω","omega":"ω","Omicron":"Ο","omicron":"ο","omid":"⦶","ominus":"⊖","Oopf":"𝕆","oopf":"𝕠","opar":"⦷","OpenCurlyDoubleQuote":"“","OpenCurlyQuote":"‘","operp":"⦹","oplus":"⊕","Or":"⩔","or":"∨","orarr":"↻","ord":"⩝","order":"ℴ","orderof":"ℴ","ordf":"ª","ordm":"º","origof":"⊶","oror":"⩖","orslope":"⩗","orv":"⩛","oS":"Ⓢ","Oscr":"𝒪","oscr":"ℴ","Oslash":"Ø","oslash":"ø","osol":"⊘","Otilde":"Õ","otilde":"õ","Otimes":"⨷","otimes":"⊗","otimesas":"⨶","Ouml":"Ö","ouml":"ö","ovbar":"⌽","OverBar":"‾","OverBrace":"⏞","OverBracket":"⎴","OverParenthesis":"⏜","par":"∥","para":"¶","parallel":"∥","parsim":"⫳","parsl":"⫽","part":"∂","PartialD":"∂","Pcy":"П","pcy":"п","percnt":"%","period":".","permil":"‰","perp":"⊥","pertenk":"‱","Pfr":"𝔓","pfr":"𝔭","Phi":"Φ","phi":"φ","phiv":"ϕ","phmmat":"ℳ","phone":"☎","Pi":"Π","pi":"π","pitchfork":"⋔","piv":"ϖ","planck":"ℏ","planckh":"ℎ","plankv":"ℏ","plus":"+","plusacir":"⨣","plusb":"⊞","pluscir":"⨢","plusdo":"∔","plusdu":"⨥","pluse":"⩲","PlusMinus":"±","plusmn":"±","plussim":"⨦","plustwo":"⨧","pm":"±","Poincareplane":"ℌ","pointint":"⨕","Popf":"ℙ","popf":"𝕡","pound":"£","Pr":"⪻","pr":"≺","prap":"⪷","prcue":"≼","prE":"⪳","pre":"⪯","prec":"≺","precapprox":"⪷","preccurlyeq":"≼","Precedes":"≺","PrecedesEqual":"⪯","PrecedesSlantEqual":"≼","PrecedesTilde":"≾","preceq":"⪯","precnapprox":"⪹","precneqq":"⪵","precnsim":"⋨","precsim":"≾","Prime":"″","prime":"′","primes":"ℙ","prnap":"⪹","prnE":"⪵","prnsim":"⋨","prod":"∏","Product":"∏","profalar":"⌮","profline":"⌒","profsurf":"⌓","prop":"∝","Proportion":"∷","Proportional":"∝","propto":"∝","prsim":"≾","prurel":"⊰","Pscr":"𝒫","pscr":"𝓅","Psi":"Ψ","psi":"ψ","puncsp":" ","Qfr":"𝔔","qfr":"𝔮","qint":"⨌","Qopf":"ℚ","qopf":"𝕢","qprime":"⁗","Qscr":"𝒬","qscr":"𝓆","quaternions":"ℍ","quatint":"⨖","quest":"?","questeq":"≟","QUOT":"\"","quot":"\"","rAarr":"⇛","race":"∽̱","Racute":"Ŕ","racute":"ŕ","radic":"√","raemptyv":"⦳","Rang":"⟫","rang":"⟩","rangd":"⦒","range":"⦥","rangle":"⟩","raquo":"»","Rarr":"↠","rArr":"⇒","rarr":"→","rarrap":"⥵","rarrb":"⇥","rarrbfs":"⤠","rarrc":"⤳","rarrfs":"⤞","rarrhk":"↪","rarrlp":"↬","rarrpl":"⥅","rarrsim":"⥴","Rarrtl":"⤖","rarrtl":"↣","rarrw":"↝","rAtail":"⤜","ratail":"⤚","ratio":"∶","rationals":"ℚ","RBarr":"⤐","rBarr":"⤏","rbarr":"⤍","rbbrk":"❳","rbrace":"}","rbrack":"]","rbrke":"⦌","rbrksld":"⦎","rbrkslu":"⦐","Rcaron":"Ř","rcaron":"ř","Rcedil":"Ŗ","rcedil":"ŗ","rceil":"⌉","rcub":"}","Rcy":"Р","rcy":"р","rdca":"⤷","rdldhar":"⥩","rdquo":"”","rdquor":"”","rdsh":"↳","Re":"ℜ","real":"ℜ","realine":"ℛ","realpart":"ℜ","reals":"ℝ","rect":"▭","REG":"®","reg":"®","ReverseElement":"∋","ReverseEquilibrium":"⇋","ReverseUpEquilibrium":"⥯","rfisht":"⥽","rfloor":"⌋","Rfr":"ℜ","rfr":"𝔯","rHar":"⥤","rhard":"⇁","rharu":"⇀","rharul":"⥬","Rho":"Ρ","rho":"ρ","rhov":"ϱ","RightAngleBracket":"⟩","RightArrow":"→","Rightarrow":"⇒","rightarrow":"→","RightArrowBar":"⇥","RightArrowLeftArrow":"⇄","rightarrowtail":"↣","RightCeiling":"⌉","RightDoubleBracket":"⟧","RightDownTeeVector":"⥝","RightDownVector":"⇂","RightDownVectorBar":"⥕","RightFloor":"⌋","rightharpoondown":"⇁","rightharpoonup":"⇀","rightleftarrows":"⇄","rightleftharpoons":"⇌","rightrightarrows":"⇉","rightsquigarrow":"↝","RightTee":"⊢","RightTeeArrow":"↦","RightTeeVector":"⥛","rightthreetimes":"⋌","RightTriangle":"⊳","RightTriangleBar":"⧐","RightTriangleEqual":"⊵","RightUpDownVector":"⥏","RightUpTeeVector":"⥜","RightUpVector":"↾","RightUpVectorBar":"⥔","RightVector":"⇀","RightVectorBar":"⥓","ring":"˚","risingdotseq":"≓","rlarr":"⇄","rlhar":"⇌","rlm":"‏","rmoust":"⎱","rmoustache":"⎱","rnmid":"⫮","roang":"⟭","roarr":"⇾","robrk":"⟧","ropar":"⦆","Ropf":"ℝ","ropf":"𝕣","roplus":"⨮","rotimes":"⨵","RoundImplies":"⥰","rpar":")","rpargt":"⦔","rppolint":"⨒","rrarr":"⇉","Rrightarrow":"⇛","rsaquo":"›","Rscr":"ℛ","rscr":"𝓇","Rsh":"↱","rsh":"↱","rsqb":"]","rsquo":"’","rsquor":"’","rthree":"⋌","rtimes":"⋊","rtri":"▹","rtrie":"⊵","rtrif":"▸","rtriltri":"⧎","RuleDelayed":"⧴","ruluhar":"⥨","rx":"℞","Sacute":"Ś","sacute":"ś","sbquo":"‚","Sc":"⪼","sc":"≻","scap":"⪸","Scaron":"Š","scaron":"š","sccue":"≽","scE":"⪴","sce":"⪰","Scedil":"Ş","scedil":"ş","Scirc":"Ŝ","scirc":"ŝ","scnap":"⪺","scnE":"⪶","scnsim":"⋩","scpolint":"⨓","scsim":"≿","Scy":"С","scy":"с","sdot":"⋅","sdotb":"⊡","sdote":"⩦","searhk":"⤥","seArr":"⇘","searr":"↘","searrow":"↘","sect":"§","semi":";","seswar":"⤩","setminus":"∖","setmn":"∖","sext":"✶","Sfr":"𝔖","sfr":"𝔰","sfrown":"⌢","sharp":"♯","SHCHcy":"Щ","shchcy":"щ","SHcy":"Ш","shcy":"ш","ShortDownArrow":"↓","ShortLeftArrow":"←","shortmid":"∣","shortparallel":"∥","ShortRightArrow":"→","ShortUpArrow":"↑","shy":"­","Sigma":"Σ","sigma":"σ","sigmaf":"ς","sigmav":"ς","sim":"∼","simdot":"⩪","sime":"≃","simeq":"≃","simg":"⪞","simgE":"⪠","siml":"⪝","simlE":"⪟","simne":"≆","simplus":"⨤","simrarr":"⥲","slarr":"←","SmallCircle":"∘","smallsetminus":"∖","smashp":"⨳","smeparsl":"⧤","smid":"∣","smile":"⌣","smt":"⪪","smte":"⪬","smtes":"⪬︀","SOFTcy":"Ь","softcy":"ь","sol":"/","solb":"⧄","solbar":"⌿","Sopf":"𝕊","sopf":"𝕤","spades":"♠","spadesuit":"♠","spar":"∥","sqcap":"⊓","sqcaps":"⊓︀","sqcup":"⊔","sqcups":"⊔︀","Sqrt":"√","sqsub":"⊏","sqsube":"⊑","sqsubset":"⊏","sqsubseteq":"⊑","sqsup":"⊐","sqsupe":"⊒","sqsupset":"⊐","sqsupseteq":"⊒","squ":"□","Square":"□","square":"□","SquareIntersection":"⊓","SquareSubset":"⊏","SquareSubsetEqual":"⊑","SquareSuperset":"⊐","SquareSupersetEqual":"⊒","SquareUnion":"⊔","squarf":"▪","squf":"▪","srarr":"→","Sscr":"𝒮","sscr":"𝓈","ssetmn":"∖","ssmile":"⌣","sstarf":"⋆","Star":"⋆","star":"☆","starf":"★","straightepsilon":"ϵ","straightphi":"ϕ","strns":"¯","Sub":"⋐","sub":"⊂","subdot":"⪽","subE":"⫅","sube":"⊆","subedot":"⫃","submult":"⫁","subnE":"⫋","subne":"⊊","subplus":"⪿","subrarr":"⥹","Subset":"⋐","subset":"⊂","subseteq":"⊆","subseteqq":"⫅","SubsetEqual":"⊆","subsetneq":"⊊","subsetneqq":"⫋","subsim":"⫇","subsub":"⫕","subsup":"⫓","succ":"≻","succapprox":"⪸","succcurlyeq":"≽","Succeeds":"≻","SucceedsEqual":"⪰","SucceedsSlantEqual":"≽","SucceedsTilde":"≿","succeq":"⪰","succnapprox":"⪺","succneqq":"⪶","succnsim":"⋩","succsim":"≿","SuchThat":"∋","Sum":"∑","sum":"∑","sung":"♪","sup1":"¹","sup2":"²","sup3":"³","Sup":"⋑","sup":"⊃","supdot":"⪾","supdsub":"⫘","supE":"⫆","supe":"⊇","supedot":"⫄","Superset":"⊃","SupersetEqual":"⊇","suphsol":"⟉","suphsub":"⫗","suplarr":"⥻","supmult":"⫂","supnE":"⫌","supne":"⊋","supplus":"⫀","Supset":"⋑","supset":"⊃","supseteq":"⊇","supseteqq":"⫆","supsetneq":"⊋","supsetneqq":"⫌","supsim":"⫈","supsub":"⫔","supsup":"⫖","swarhk":"⤦","swArr":"⇙","swarr":"↙","swarrow":"↙","swnwar":"⤪","szlig":"ß","Tab":"\t","target":"⌖","Tau":"Τ","tau":"τ","tbrk":"⎴","Tcaron":"Ť","tcaron":"ť","Tcedil":"Ţ","tcedil":"ţ","Tcy":"Т","tcy":"т","tdot":"⃛","telrec":"⌕","Tfr":"𝔗","tfr":"𝔱","there4":"∴","Therefore":"∴","therefore":"∴","Theta":"Θ","theta":"θ","thetasym":"ϑ","thetav":"ϑ","thickapprox":"≈","thicksim":"∼","ThickSpace":"  ","thinsp":" ","ThinSpace":" ","thkap":"≈","thksim":"∼","THORN":"Þ","thorn":"þ","Tilde":"∼","tilde":"˜","TildeEqual":"≃","TildeFullEqual":"≅","TildeTilde":"≈","times":"×","timesb":"⊠","timesbar":"⨱","timesd":"⨰","tint":"∭","toea":"⤨","top":"⊤","topbot":"⌶","topcir":"⫱","Topf":"𝕋","topf":"𝕥","topfork":"⫚","tosa":"⤩","tprime":"‴","TRADE":"™","trade":"™","triangle":"▵","triangledown":"▿","triangleleft":"◃","trianglelefteq":"⊴","triangleq":"≜","triangleright":"▹","trianglerighteq":"⊵","tridot":"◬","trie":"≜","triminus":"⨺","TripleDot":"⃛","triplus":"⨹","trisb":"⧍","tritime":"⨻","trpezium":"⏢","Tscr":"𝒯","tscr":"𝓉","TScy":"Ц","tscy":"ц","TSHcy":"Ћ","tshcy":"ћ","Tstrok":"Ŧ","tstrok":"ŧ","twixt":"≬","twoheadleftarrow":"↞","twoheadrightarrow":"↠","Uacute":"Ú","uacute":"ú","Uarr":"↟","uArr":"⇑","uarr":"↑","Uarrocir":"⥉","Ubrcy":"Ў","ubrcy":"ў","Ubreve":"Ŭ","ubreve":"ŭ","Ucirc":"Û","ucirc":"û","Ucy":"У","ucy":"у","udarr":"⇅","Udblac":"Ű","udblac":"ű","udhar":"⥮","ufisht":"⥾","Ufr":"𝔘","ufr":"𝔲","Ugrave":"Ù","ugrave":"ù","uHar":"⥣","uharl":"↿","uharr":"↾","uhblk":"▀","ulcorn":"⌜","ulcorner":"⌜","ulcrop":"⌏","ultri":"◸","Umacr":"Ū","umacr":"ū","uml":"¨","UnderBar":"_","UnderBrace":"⏟","UnderBracket":"⎵","UnderParenthesis":"⏝","Union":"⋃","UnionPlus":"⊎","Uogon":"Ų","uogon":"ų","Uopf":"𝕌","uopf":"𝕦","UpArrow":"↑","Uparrow":"⇑","uparrow":"↑","UpArrowBar":"⤒","UpArrowDownArrow":"⇅","UpDownArrow":"↕","Updownarrow":"⇕","updownarrow":"↕","UpEquilibrium":"⥮","upharpoonleft":"↿","upharpoonright":"↾","uplus":"⊎","UpperLeftArrow":"↖","UpperRightArrow":"↗","Upsi":"ϒ","upsi":"υ","upsih":"ϒ","Upsilon":"Υ","upsilon":"υ","UpTee":"⊥","UpTeeArrow":"↥","upuparrows":"⇈","urcorn":"⌝","urcorner":"⌝","urcrop":"⌎","Uring":"Ů","uring":"ů","urtri":"◹","Uscr":"𝒰","uscr":"𝓊","utdot":"⋰","Utilde":"Ũ","utilde":"ũ","utri":"▵","utrif":"▴","uuarr":"⇈","Uuml":"Ü","uuml":"ü","uwangle":"⦧","vangrt":"⦜","varepsilon":"ϵ","varkappa":"ϰ","varnothing":"∅","varphi":"ϕ","varpi":"ϖ","varpropto":"∝","vArr":"⇕","varr":"↕","varrho":"ϱ","varsigma":"ς","varsubsetneq":"⊊︀","varsubsetneqq":"⫋︀","varsupsetneq":"⊋︀","varsupsetneqq":"⫌︀","vartheta":"ϑ","vartriangleleft":"⊲","vartriangleright":"⊳","Vbar":"⫫","vBar":"⫨","vBarv":"⫩","Vcy":"В","vcy":"в","VDash":"⊫","Vdash":"⊩","vDash":"⊨","vdash":"⊢","Vdashl":"⫦","Vee":"⋁","vee":"∨","veebar":"⊻","veeeq":"≚","vellip":"⋮","Verbar":"‖","verbar":"|","Vert":"‖","vert":"|","VerticalBar":"∣","VerticalLine":"|","VerticalSeparator":"❘","VerticalTilde":"≀","VeryThinSpace":" ","Vfr":"𝔙","vfr":"𝔳","vltri":"⊲","vnsub":"⊂⃒","vnsup":"⊃⃒","Vopf":"𝕍","vopf":"𝕧","vprop":"∝","vrtri":"⊳","Vscr":"𝒱","vscr":"𝓋","vsubnE":"⫋︀","vsubne":"⊊︀","vsupnE":"⫌︀","vsupne":"⊋︀","Vvdash":"⊪","vzigzag":"⦚","Wcirc":"Ŵ","wcirc":"ŵ","wedbar":"⩟","Wedge":"⋀","wedge":"∧","wedgeq":"≙","weierp":"℘","Wfr":"𝔚","wfr":"𝔴","Wopf":"𝕎","wopf":"𝕨","wp":"℘","wr":"≀","wreath":"≀","Wscr":"𝒲","wscr":"𝓌","xcap":"⋂","xcirc":"◯","xcup":"⋃","xdtri":"▽","Xfr":"𝔛","xfr":"𝔵","xhArr":"⟺","xharr":"⟷","Xi":"Ξ","xi":"ξ","xlArr":"⟸","xlarr":"⟵","xmap":"⟼","xnis":"⋻","xodot":"⨀","Xopf":"𝕏","xopf":"𝕩","xoplus":"⨁","xotime":"⨂","xrArr":"⟹","xrarr":"⟶","Xscr":"𝒳","xscr":"𝓍","xsqcup":"⨆","xuplus":"⨄","xutri":"△","xvee":"⋁","xwedge":"⋀","Yacute":"Ý","yacute":"ý","YAcy":"Я","yacy":"я","Ycirc":"Ŷ","ycirc":"ŷ","Ycy":"Ы","ycy":"ы","yen":"¥","Yfr":"𝔜","yfr":"𝔶","YIcy":"Ї","yicy":"ї","Yopf":"𝕐","yopf":"𝕪","Yscr":"𝒴","yscr":"𝓎","YUcy":"Ю","yucy":"ю","Yuml":"Ÿ","yuml":"ÿ","Zacute":"Ź","zacute":"ź","Zcaron":"Ž","zcaron":"ž","Zcy":"З","zcy":"з","Zdot":"Ż","zdot":"ż","zeetrf":"ℨ","ZeroWidthSpace":"​","Zeta":"Ζ","zeta":"ζ","Zfr":"ℨ","zfr":"𝔷","ZHcy":"Ж","zhcy":"ж","zigrarr":"⇝","Zopf":"ℤ","zopf":"𝕫","Zscr":"𝒵","zscr":"𝓏","zwj":"‍","zwnj":"‌"};
  var ingestBad = false;
  function decodeNumeric(body) {
    var hex = body.charAt(1) === "x" || body.charAt(1) === "X";
    var cp = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
    if (!isFinite(cp) || cp < 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) return null;
    try { return String.fromCodePoint(cp); } catch (e) { return null; }
  }
  function decodeEntities(s) {
    return s.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-zA-Z][a-zA-Z0-9]*);/gi, function (all, body) {
      if (body.charAt(0) === "#") {
        var ch = decodeNumeric(body);
        return ch == null ? all : ch;
      }
      var v = ENT[body];
      if (v == null) v = ENT[body.toLowerCase()];
      return v == null ? all : v;
    });
  }
  function pctUtf8(s) {
    return s.replace(/(?:%[0-9A-Fa-f]{2})+/g, function (run) {
      try { return decodeURIComponent(run); }
      catch (e) {
        return run.replace(/%([0-9A-Fa-f]{2})/g, function (_, h) {
          return String.fromCharCode(parseInt(h, 16));
        });
      }
    });
  }
  /* Entity decode, UTF-8 percent-decode, and tag strip, together, until stable. */
  function normalizeIngest(s) {
    var t = String(s == null ? "" : s);
    var prev, n = 0;
    do {
      prev = t;
      t = decodeEntities(t);
      t = pctUtf8(t);
      t = t.replace(/<[^>]*>/g, "");
      n++;
    } while (t !== prev && n < 8);
    /* An unknown &name; stays literal text. It is not a reason to drop the row. */
    var bad = t !== prev;
    t = nfkd(t);
    try { t = t.replace(/\p{M}/gu, ""); }
    catch (e) { t = t.replace(/[\u0300-\u036F]/g, ""); }
    try { t = t.replace(/\p{Cf}/gu, ""); }
    catch (e2) { t = t.replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u061C\uFEFF]/g, ""); }
    t = t.replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
    t = t.replace(/\u00AD/g, "");
    return { text: t, bad: bad };
  }
  function enclosedLetter(cp) {
    if (cp >= 0x1F1E6 && cp <= 0x1F1FF) return String.fromCharCode(97 + (cp - 0x1F1E6));
    if (cp >= 0x1F130 && cp <= 0x1F149) return String.fromCharCode(97 + (cp - 0x1F130));
    if (cp >= 0x1F150 && cp <= 0x1F169) return String.fromCharCode(97 + (cp - 0x1F150));
    if (cp >= 0x1F170 && cp <= 0x1F189) return String.fromCharCode(97 + (cp - 0x1F170));
    if (cp >= 0x249C && cp <= 0x24B5) return String.fromCharCode(97 + (cp - 0x249C));
    if (cp >= 0x24B6 && cp <= 0x24CF) return String.fromCharCode(97 + (cp - 0x24B6));
    if (cp >= 0x24D0 && cp <= 0x24E9) return String.fromCharCode(97 + (cp - 0x24D0));
    if (cp >= 0x1F110 && cp <= 0x1F129) return String.fromCharCode(97 + (cp - 0x1F110));
    return "";
  }
  function leftoverEnclosed(cp) {
    if (enclosedLetter(cp)) return false;
    if (cp >= 0x1D400 && cp <= 0x1D7FF) return true;
    if (cp >= 0x249C && cp <= 0x24E9) return true;
    if (cp >= 0x1F110 && cp <= 0x1F189) return true;
    if (cp >= 0x1F1E6 && cp <= 0x1F1FF) return true;
    return false;
  }
  /* Normalize, map enclosed letters and look-alikes, then case-fold. */
  function prepText(s) {
    var ing = normalizeIngest(s);
    if (ing.bad) ingestBad = true;
    var t = ing.text;
    var out = "";
    var i = 0;
    while (i < t.length) {
      var cp = t.codePointAt(i);
      var ch = String.fromCodePoint(cp);
      i += cp > 0xFFFF ? 2 : 1;
      if (leftoverEnclosed(cp)) ingestBad = true;
      out += enclosedLetter(cp) || LOOK[ch] || ch;
    }
    try { out = out.toLowerCase(); } catch (e2) { /* already folded */ }
    return out;
  }
  /* Digit-for-letter stays inside one token that already has a letter and a digit. */
  function foldDigits(s, one) {
    return s.replace(/[013457]/g, function (d) {
      return d === "0" ? "o" : d === "1" ? one : d === "3" ? "e" : d === "4" ? "a" : d === "5" ? "s" : "t";
    });
  }
  /* Digits, @, $, separators and zero-width marks can still spell a boy name. */
  function boyFold(text) {
    var s = prepText(text).replace(/[@$]/g, function (c) { return c === "@" ? "a" : "s"; });
    s = s.replace(/[^a-z0-9]/g, "");
    return /hayes|harris/.test(foldDigits(s, "i")) || /hayes|harris/.test(foldDigits(s, "l"));
  }
  /* A contiguous spelling stays on the marker rule. A zero-width-only spelling
     drops (r37). Digits, @, $, and separators are the folded form Dad may show. */
  function titleHasBoy(ev) {
    var raw = titleBlob(ev);
    if (/hayes|harris/i.test(raw)) return false;
    var bare = String(raw).replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u061C\uFEFF\u180E]/g, "");
    if (/hayes|harris/i.test(bare)) return false;
    return boyFold(raw);
  }
  function nameHit(text) {
    var s = String(text || "");
    if (/hayes|harris/.test(s.replace(/[^a-z]/g, ""))) return true;
    var tokens = s.split(/[^a-z0-9]+/);
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (!/[a-z]/.test(tok) || !/[0-9]/.test(tok)) continue;
      if (/hayes|harris/.test(foldDigits(tok, "i")) || /hayes|harris/.test(foldDigits(tok, "l"))) return true;
    }
    return false;
  }
  /* Appointment words, including a digit-folded or separator-stripped disguise.
     ot and pt match a whole token only, so "photo" and "soccer" stay activities. */
  var APPT_LONG = ["appointment", "session", "dentist", "doctor", "therapy", "therapist", "appt", "speech", "ortho", "orthodontist", "pediatric", "pediatrician", "checkup", "physical", "clinic", "evaluation", "tutoring", "urgentcare", "eyeexam", "flushot", "psycheval", "allergist", "dental"];
  var APPT_SHORT = { ot: 1, pt: 1, appt: 1, aba: 1, er: 1, mtg: 1, labs: 1, exam: 1, eval: 1, shot: 1 };
  function apptForms(s) {
    var p = prepText(s);
    var flat = p.replace(/[^a-z0-9]/g, "");
    return [flat, foldDigits(flat, "i"), foldDigits(flat, "l")];
  }
  function apptKeyword(s) {
    var forms = apptForms(s);
    var w, f, i;
    for (w = 0; w < APPT_LONG.length; w++) {
      for (f = 0; f < forms.length; f++) if (forms[f].indexOf(APPT_LONG[w]) >= 0) return true;
    }
    var tokens = prepText(s).split(/[^a-z0-9]+/);
    for (i = 0; i < tokens.length; i++) {
      var a = tokens[i], b = foldDigits(a, "i"), c = foldDigits(a, "l");
      if (APPT_SHORT[a] || APPT_SHORT[b] || APPT_SHORT[c]) return true;
    }
    return false;
  }
  var SKIP_SCAN = /^(id|kind|startIso|endIso|start|end|when|time|tz|status|tone|wardosShow|allDay|leaveBy|timeRole)$/i;
  var KEY_BAGS = /^(attendees|organizer|creator|extendedProperties|conferenceData|location)$/i;
  function walkValues(v, fn, seen, keysToo) {
    if (typeof v === "string") { fn(v); return; }
    if (!v || typeof v !== "object") return;
    if (seen) { if (seen.has(v)) return; seen.add(v); }
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) walkValues(v[i], fn, seen, keysToo); return; }
    var keys = Object.keys(v);
    for (var k = 0; k < keys.length; k++) {
      if (SKIP_SCAN.test(keys[k])) continue;
      if (keysToo || KEY_BAGS.test(keys[k])) fn(keys[k]);
      walkValues(v[keys[k]], fn, seen, keysToo || KEY_BAGS.test(keys[k]));
    }
  }
  /* Any appointment or health word, in any field, wins over a sport or school label. */
  function isAppointment(ev) {
    if (ev == null) return false;
    if (typeof ev !== "object") return apptKeyword(String(ev));
    var hit = false;
    walkValues(ev, function (s) { if (!hit && apptKeyword(s)) hit = true; }, typeof WeakSet === "function" ? new WeakSet() : null, false);
    return hit;
  }
  /* A show line is the whole line, case-sensitive, after ASCII trim. A zero-width or bidi mark keeps it from matching. */
  function exactShowLine(text) {
    var lines = String(text || "").split(/\r\n|\n|\r/);
    var i;
    for (i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^[ \t\f\v]+|[ \t\f\v]+$/g, "");
      if (line === "#wardos-show") return true;
    }
    return false;
  }
  function wardosShow(ev) {
    if (!ev || typeof ev !== "object") return false;
    if (ev.wardosShow === true) return true;
    var priv = ev.extendedProperties && ev.extendedProperties.private;
    if (priv && priv["wardos.show"] === "1") return true;
    if (exactShowLine(ev.description)) return true;
    return false;
  }
  function pushStrings(v, out, seen) {
    if (typeof v === "string") { out.push(v); return; }
    if (!v || typeof v !== "object") return;
    if (seen) { if (seen.has(v)) return; seen.add(v); }
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) pushStrings(v[i], out, seen); return; }
    var keys = Object.keys(v);
    for (var k = 0; k < keys.length; k++) {
      if (SKIP_KEY.test(keys[k]) || /iso$/i.test(keys[k])) continue;
      pushStrings(v[keys[k]], out, seen);
    }
  }
  function rowStrings(ev) {
    var out = [];
    pushStrings(ev, out, typeof WeakSet === "function" ? new WeakSet() : null);
    if (ev && typeof ev === "object") {
      ["owner", "who", "with", "kidName"].forEach(function (k) {
        if (typeof ev[k] === "string") out.push(ev[k]);
      });
      pushNamed(ev.attendees, out);
      pushNamed(ev.organizer, out);
      pushNamed(ev.creator, out);
    }
    return out;
  }
  function pushNamed(v, out) {
    if (typeof v === "string") { out.push(v); return; }
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) pushNamed(v[i], out); return; }
    var keys = Object.keys(v);
    for (var k = 0; k < keys.length; k++) { out.push(keys[k]); pushNamed(v[keys[k]], out); }
  }
  function boyNamed(ev) {
    var bits = rowStrings(ev);
    for (var i = 0; i < bits.length; i++) {
      var p = prepText(bits[i]);
      if (nameHit(p)) return true;
      if (/hayes|harris/.test(p.replace(/[^a-z]/g, ""))) return true;
    }
    return false;
  }
  function hasWord(ev, word) {
    var bits = rowStrings(ev);
    var re = new RegExp("\\b" + word + "\\b");
    for (var i = 0; i < bits.length; i++) if (re.test(prepText(bits[i]))) return true;
    return false;
  }
  /* No name allow. An appointment renders only when the show marker is present. */
  function keepAppointment(ev) {
    return !!(ev && isAppointment(ev) && wardosShow(ev));
  }
  function skeletonOf(s) { return prepText(s).replace(/[^a-z]/g, ""); }
  function foreignLetter(s) {
    var t = prepText(s).replace(/[a-z]/g, "");
    try { return /\p{L}/u.test(t); }
    catch (e) { return /[^\u0000-\u007F]/.test(t); }
  }
  function walkRow(v, bag, seen) {
    if (typeof v === "string") { bag.push(v); return; }
    if (!v || typeof v !== "object") return;
    if (seen) { if (seen.has(v)) return; seen.add(v); }
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) walkRow(v[i], bag, seen); return; }
    var keys = Object.keys(v);
    for (var k = 0; k < keys.length; k++) { bag.push(keys[k]); walkRow(v[keys[k]], bag, seen); }
  }
  /* Appointment rows only. A boy-name skeleton, or any letter still outside Latin a-z, drops the row. */
  function boyAppt(ev) {
    var bag = [];
    ingestBad = false;
    walkRow(ev, bag, typeof WeakSet === "function" ? new WeakSet() : null);
    var skels = [], foreign = false, appt = false, named = false;
    for (var i = 0; i < bag.length; i++) {
      var p = prepText(bag[i]);
      skels.push(p.replace(/[^a-z]/g, ""));
      if (nameHit(p)) named = true;
      if (!foreign && foreignLetter(bag[i])) foreign = true;
      if (!appt && APPT_WORD.test(p)) appt = true;
    }
    if (!appt && /appointment|session|dentist/.test(skels.join(""))) appt = true;
    if (!appt) return false;
    if (foreign || ingestBad) return true;
    if (named) return true;
    if (/hayes|harris/.test(skels.join(""))) return true;
    return false;
  }
  function titleBlob(ev) {
    if (!ev || typeof ev !== "object") return nfkc(textOf(ev));
    return nfkc([ev.summary, ev.title, ev.what, ev.label, ev.text, ev.l].map(textOf).filter(Boolean).join("\n"));
  }
  function kindBlob(ev) {
    if (!ev || typeof ev !== "object") return "";
    return nfkc([ev.kind, ev.category, ev.safeCategory, ev.type].map(textOf).filter(Boolean).join("\n"));
  }
  /* Every prose field, before any title is rewritten or cleared. */
  function sourceBlob(ev) {
    if (ev == null) return "";
    if (typeof ev !== "object") return nfkc(textOf(ev));
    var parts = [];
    Object.keys(ev).forEach(function (k) {
      if (SKIP_KEY.test(k) || /iso$/i.test(k)) return;
      var v = ev[k];
      if (typeof v === "string") parts.push(v);
    });
    return nfkc(parts.join("\n"));
  }
  function isBoy(audience) {
    var a = String(audience || "").toLowerCase();
    return a === "hayes" || a === "harris";
  }
  function isDenied(ev, audience) {
    if (!ev) return false;
    if (typeof ev === "string") ev = { summary: ev, what: ev };
    if (ev.status === "cancelled" || ev.status === "canceled") return true;
    if (CANCEL.test(titleBlob(ev))) return true;
    if (isAppointment(ev)) {
      if (titleHasBoy(ev)) return false;
      return !wardosShow(ev);
    }
    var blob = sourceBlob(ev);
    if (HARD.test(prepText(blob)) || HARD.test(blob)) return true;
    if (isBoy(audience) || isBoy(ev.kid) || isBoy(ev.owner) || isBoy(ev.kidId)) {
      if (SOFT.test(blob) || SOFT.test(prepText(blob))) return true;
    }
    if (boyNamed(ev) && !cannedTitle(ev)) return true;
    return false;
  }

  function audienceOf(audience) {
    var a = String(audience || "child").toLowerCase();
    if (a === "adult" || a === "dad" || a === "dan") return "adult";
    if (a === "ainsley") return "ainsley";
    if (a === "shared" || a === "hub") return "shared";
    return "child";
  }

  function ctParts(date) {
    var map = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).formatToParts(date).forEach(function (p) {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    return map;
  }

  function clockFromIso(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(+d)) return "";
    try {
      var p = ctParts(d);
      if (!p.hour || !p.minute) return "";
      var ap = String(p.dayPeriod || "").toUpperCase();
      if (ap !== "AM" && ap !== "PM") ap = "";
      return p.hour + ":" + p.minute + (ap ? " " + ap : "");
    } catch (e) {
      return "";
    }
  }

  function minutesOfClock(h, m, ap) {
    var hh = Number(h);
    var mm = m == null || m === "" ? 0 : Number(m);
    if (!isFinite(hh) || !isFinite(mm)) return null;
    if (ap) {
      var pm = /^p/i.test(ap);
      if (hh === 12) hh = pm ? 12 : 0;
      else if (pm) hh += 12;
    }
    return hh * 60 + mm;
  }

  function rangeStart(text) {
    var m = String(text || "").match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?/i);
    if (!m) return null;
    return minutesOfClock(m[1], m[2], m[3]);
  }

  function isoMinutes(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(+d)) return null;
    try {
      var p = ctParts(d);
      return minutesOfClock(p.hour, p.minute, p.dayPeriod);
    } catch (e) {
      return null;
    }
  }

  function isLeave(ev, text) {
    var kind = textOf(ev && ev.kind) + " " + textOf(ev && ev.category);
    if (ev && (ev.leaveBy === true || ev.timeRole === "leave")) return true;
    if (/\bleave\b/i.test(kind) || kind.indexOf("school_pickup") >= 0 || kind.indexOf("school_drop") >= 0) return true;
    if (/\bleave\b/i.test(text)) return true;
    var rs = rangeStart(text);
    var sm = isoMinutes(ev && (ev.startIso || ev.start));
    return rs != null && sm != null && rs !== sm;
  }

  function cannedTitle(ev) {
    var text = titleBlob(ev);
    var kind = kindBlob(ev);
    if (CANCEL.test(text)) return null;
    var leave = isLeave(ev, text);
    if (/school[_\s-]*pickup|\bpick\s*-?\s*up\b/i.test(text) || /school_pickup/.test(kind)) return "School pickup";
    if (/school[_\s-]*drop|\bdrop(?:\s*-?\s*off)?\b/i.test(text) || /school_drop/.test(kind)) return "School drop";
    if (/\bswim\b/i.test(text) || /\bswim\b/i.test(kind)) return leave ? "Leave for swim" : "Swim";
    if (/\bsoccer\b/i.test(text) || /\bsoccer\b/i.test(kind)) return leave ? "Leave for soccer" : "Soccer";
    if (/\bbaseball\b/i.test(text)) return leave ? "Leave for baseball" : "Baseball";
    if (/\bflag\b/i.test(text)) return leave ? "Leave for flag" : "Flag";
    if (/\bspecials?\b/i.test(text)) return "School specials";
    if (/\bno school\b/i.test(text)) return "No school";
    if (/\bfield trip\b/i.test(text)) return "Field trip";
    if (/\bart club\b/i.test(text)) return "Art club";
    if (/\bconference\b/i.test(text)) return "Conference";
    if (/\bpicture day\b/i.test(text)) return "Picture day";
    if (/\bhomework\b/i.test(text)) return "Homework";
    if (/\bchoir\b/i.test(text)) return "Choir";
    if (/\braffle\b/i.test(text)) return "Raffle";
    if (/\bbook order\b/i.test(text)) return "Book order";
    if (/\bdonation\b/i.test(text)) return "Donation";
    if (/\bHOA\b/.test(text)) return "HOA";
    if (/^Nothing else on the calendar today$/i.test(text.trim())) return "Nothing else today";
    if (/^More on the month calendar$/i.test(text.trim())) return "More on the month calendar";
    return null;
  }

  function allDay(ev) {
    if (!ev || typeof ev !== "object") return false;
    if (ev.allDay === true) return true;
    return /\ball day\b/i.test(textOf(ev.when) + " " + textOf(ev.time));
  }

  function timeLabel(ev, audience) {
    audienceOf(audience); /* Dan, Nov 10 2026, 6:08 PM CT: Ainsley gets the same clock time as every other board. */
    if (allDay(ev)) return "All day";
    var iso = ev && (ev.startIso || (typeof ev.start === "string" && /T\d{2}:/.test(ev.start) ? ev.start : ""));
    var fromIso = clockFromIso(iso);
    if (fromIso) return fromIso;
    var when = textOf(ev && (ev.time || ev.when));
    if (!when || RANGE.test(when)) return "";
    var m = when.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (!m) return "";
    var clock = m[1].replace(/\s+/g, " ").trim();
    if (/[ap]m/i.test(clock)) return clock.replace(/\s*([ap])m/i, function (_, ap) { return " " + ap.toUpperCase() + "M"; });
    return clock;
  }

  function plainTitle(ev) {
    var ing = normalizeIngest(titleBlob(ev));
    return ing.text.replace(/\s+/g, " ").trim();
  }

  function summarize(ev, audience) {
    var who = audienceOf(audience);
    if (typeof ev === "string") ev = { summary: ev, what: ev };
    if (!ev || typeof ev !== "object") return null;
    if (ev.status === "cancelled" || ev.status === "canceled") return null;
    if (CANCEL.test(titleBlob(ev))) return null;
    if (ev.dadOnly && who !== "adult") return null;
    var title = "";
    if (isAppointment(ev)) {
      /* Locked views drop a boy-name row even when it is marked. Dad's own board
         shows Appointment for a folded name plus a health word. A zero-width
         spelling is not that folded form. An unmarked row with no folded name drops. */
      if (who === "adult" && titleHasBoy(ev)) title = "Appointment";
      else if (titleHasBoy(ev) || !wardosShow(ev)) return null;
      else title = "Appointment";
    } else {
      if (HARD.test(prepText(sourceBlob(ev)))) return null;
      title = cannedTitle(ev);
      if (!title) {
        /* Kid boards, the shared hub (including the Dad tile) and the calendar views never show free text. */
        if (who !== "adult") return null;
        if (boyNamed(ev)) return null;
        title = plainTitle(ev);
      }
      if (!title) return null;
    }
    var time = timeLabel(ev, who);
    return {
      id: ev.id || "",
      title: title,
      time: time,
      allDay: time === "All day",
      startIso: textOf(ev.startIso || (typeof ev.start === "string" ? ev.start : "")),
      endIso: textOf(ev.endIso || ""),
      audience: who
    };
  }

  function clearProse(row) {
    ["hint", "where", "description", "location", "notes", "place", "detail", "blurb"].forEach(function (k) {
      if (typeof row[k] === "string") row[k] = "";
    });
  }

  function applyRow(row, audience) {
    if (row && row.dadOnly && audienceOf(audience) !== "adult") return null;
    var view = summarize(row, audience);
    if (!view) return null;
    /* Allowlist by construction: the row that reaches a board is the label, the clock, and the show flag. */
    var label = view.title;
    var kid = /^(ainsley|hayes|harris|dan)$/i.test(String(row.kid || "")) ? String(row.kid).toLowerCase() : "";
    var next = {
      id: row.id || "",
      what: label,
      title: label,
      summary: label,
      label: label,
      text: label,
      when: view.time || "",
      time: view.time || "",
      startIso: textOf(row.startIso || (typeof row.start === "string" ? row.start : "")),
      endIso: textOf(row.endIso || "")
    };
    if (view.allDay) next.allDay = true;
    if (label === "Appointment") next.wardosShow = true;
    if (kid) next.kid = kid;
    var oldKeys = Object.keys(row);
    for (var i = 0; i < oldKeys.length; i++) delete row[oldKeys[i]];
    var keepKeys = Object.keys(next);
    for (var j = 0; j < keepKeys.length; j++) row[keepKeys[j]] = next[keepKeys[j]];
    row.what = view.title;
    row.title = view.title;
    row.summary = view.title;
    row.label = view.title;
    row.text = view.title;
    if (typeof row.l === "string") row.l = view.title;
    clearProse(row);
    if (view.time) {
      row.when = view.time;
      row.time = view.time;
    }
    return row;
  }

  function scrubList(list, audience) {
    if (!Array.isArray(list)) return list;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (!row || typeof row !== "object") continue;
      if (applyRow(row, audience)) out.push(row);
    }
    return out;
  }

  function scrubKid(kid, audience) {
    if (!kid || typeof kid !== "object") return kid;
    LISTS.forEach(function (k) {
      if (Array.isArray(kid[k])) kid[k] = scrubList(kid[k], audience);
      else if (kid[k] && typeof kid[k] === "object") {
        if (!applyRow(kid[k], audience)) kid[k] = null;
      }
    });
    if (kid.hottest && typeof kid.hottest === "object") {
      if (!applyRow(kid.hottest, audience)) kid.hottest = null;
    }
    return kid;
  }

  function scrubPayload(data) {
    if (!data || typeof data !== "object") return data;
    var kids = data.kids || {};
    Object.keys(kids).forEach(function (id) {
      scrubKid(kids[id], "shared");
    });
    if (Array.isArray(data.leaveBys)) data.leaveBys = scrubList(data.leaveBys, "shared");
    if (data.boardStrip && typeof data.boardStrip === "object") {
      if (Array.isArray(data.boardStrip.queue)) data.boardStrip.queue = scrubList(data.boardStrip.queue, "shared");
      if (data.boardStrip.nextLeave && typeof data.boardStrip.nextLeave === "object") {
        if (!applyRow(data.boardStrip.nextLeave, "shared")) data.boardStrip.nextLeave = null;
      }
    }
    return data;
  }

  function escapeText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  global.HouseEventDisplay = {
    CLINICAL: CLINICAL,
    isDenied: isDenied,
    allowTitle: cannedTitle,
    isAppointment: isAppointment,
    keepAppointment: keepAppointment,
    timeLabel: timeLabel,
    summarize: summarize,
    LABELS: ["School pickup", "School drop", "Leave for swim", "Swim", "Leave for soccer", "Soccer", "Leave for baseball", "Baseball", "Leave for flag", "Flag", "School specials", "No school", "Field trip", "Art club", "Conference", "Picture day", "Homework", "Choir", "Raffle", "Book order", "Donation", "HOA", "Nothing else today", "More on the month calendar", "Appointment"],
    scrubPayload: scrubPayload,
    scrubKid: scrubKid,
    escapeText: escapeText,
    clockFromIso: clockFromIso
  };
})(typeof window !== "undefined" ? window : globalThis);
