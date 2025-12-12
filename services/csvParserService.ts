

import type { RawTransaction, TransactionType, AmazonMetric } from '../types';
import { generateUUID } from '../utils';

declare const pdfjsLib: any;

const cleanDescription = (string: string): string => {
  // Cleans up common noise from transaction descriptions for better readability.
  // "COSTCO WHSE #0733 " -> "COSTCO WHSE #0733"
  // "'AMAZON PRIME'," -> "AMAZON PRIME"
  let cleaned = string.trim();
  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s+/g, ' ');
  // Remove one or more quotes from the start and end
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  // Remove one or more trailing commas or periods
  cleaned = cleaned.replace(/[,.]+$/, '');
  
  // Clean up common bank statement noise prefixes
  cleaned = cleaned.replace(/^(Pos Debit|Debit Purchase|Recurring Payment|Preauthorized Debit|Checkcard|Visa Purchase) - /i, '');
  
  // Trim again in case the removals left whitespace at the ends
  return cleaned.trim();
};

const toTitleCase = (str: string): string => {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
};

const CITIES_BY_STATE = {
    "AL": ["birmingham", "huntsville", "montgomery", "mobile", "tuscaloosa", "hoover", "dothan", "auburn", "decatur", "madison", "florence", "gadsden", "vestavia hills", "prattville", "phenix city", "alabaster", "bessemer", "enterprise", "opelika", "homewood", "northport", "anniston", "prichard", "athens", "daphne", "pelham", "oxford", "selma", "mountain brook", "trussville", "troy", "cullman", "albertville", "scottsboro", "fort payne", "millbrook", "fairhope", "ozark", "muscle shoals", "talladega", "hartselle", "saraland", "helena", "jasper", "gardendale", "pell city", "alexander city", "center point", "andalusia", "foley"],
    "AK": ["anchorage", "fairbanks", "juneau", "wasilla", "sitka", "ketchikan", "kenai", "kodiak", "bethel", "palmer", "homer", "unalaska", "barrow (utqiaġvik)", "soldotna", "valdez", "nome", "kotzebue", "seward", "cordova", "dillingham", "petersburg", "wrangell", "craig", "hooper bay", "haines", "naknek", "sand point", "king cove", "akutan", "houston", "sterling", "nikiski", "eielson afb", "meadow lakes", "steele creek", "gateway", "kalifornsky", "tanaina", "college", "north pole", "badger", "knik-fairview", "butte", "big lake", "fishhook", "fritz creek", "willow", "ridgeway", "lazy mountain", "chena ridge"],
    "AZ": ["phoenix", "tucson", "mesa", "chandler", "scottsdale", "glendale", "gilbert", "tempe", "peoria", "surprise", "yuma", "avondale", "goodyear", "flagstaff", "buckeye", "lake havasu city", "casa grande", "sierra vista", "maricopa", "oro valley", "prescott", "bullhead city", "prescott valley", "marana", "apache junction", "kingman", "queen creek", "florence", "san tan valley", "catalina foothills", "fortuna foothills", "casas adobes", "sahuarita", "drexel heights", "nogales", "sun city", "flowing wells", "anthem", "sun city west", "fountain hills", "douglas", "eloy", "tanque verde", "green valley", "payson", "cottonwood", "san luis", "el mirage", "somerton", "new river"],
    "AR": ["little rock", "fort smith", "fayetteville", "springdale", "jonesboro", "north little rock", "conway", "rogers", "bentonville", "pine bluff", "hot springs", "benton", "sherwood", "texarkana", "russellville", "jacksonville", "bella vista", "paragould", "cabot", "searcy", "van buren", "el dorado", "west memphis", "siloam springs", "bryant", "maumelle", "blytheville", "forrest city", "camden", "harrison", "mountain home", "helena-west helena", "magnolia", "arkadelphia", "hope", "batesville", "stuttgart", "clarksville", "malvern", "wynne", "monticello", "hot springs village", "greenwood", "crossett", "trumann", "mena", "newport", "heber springs", "pocahontas", "centerton"],
    "CA": ["los angeles", "la", "san diego", "san jose", "san francisco", "sf", "fresno", "sacramento", "long beach", "oakland", "bakersfield", "anaheim", "santa ana", "riverside", "stockton", "irvine", "chula vista", "fremont", "san bernardino", "modesto", "fontana", "oxnard", "moreno valley", "huntington beach", "glendale", "santa clarita", "garden grove", "oceanside", "rancho cucamonga", "santa rosa", "ontario", "lancaster", "elk grove", "corona", "palmdale", "salinas", "pomona", "hayward", "escondido", "sunnyvale", "torrance", "pasadena", "orange", "fullerton", "thousand oaks", "visalia", "roseville", "concord", "simi valley", "santa clara", "victorville", "vallejo"],
    "CO": ["denver", "colorado springs", "aurora", "fort collins", "lakewood", "thornton", "arvada", "westminster", "pueblo", "centennial", "boulder", "greeley", "longmont", "loveland", "broomfield", "grand junction", "castle rock", "commerce city", "parker", "littleton", "northglenn", "brighton", "englewood", "wheat ridge", "fountain", "lafayette", "windsor", "erie", "evans", "golden", "louisville", "montrose", "durango", "greenwood village", "highlands ranch", "fort morgan", "cañon city", "ken caryl", "security-widefield", "columbine", "castle pines", "pueblo west", "clifton", "sterling", "johnstown", "firestone", "sherrelwood", "frederick", "cimarron hills", "lone tree"],
    "CT": ["bridgeport", "new haven", "stamford", "hartford", "waterbury", "norwalk", "danbury", "new britain", "meriden", "bristol", "west haven", "milford", "middletown", "norwich", "shelton", "torrington", "new london", "ansonia", "derby", "groton", "stratford", "naugatuck", "hamden", "manchester", "east hartford", "west hartford", "enfield", "southington", "glastonbury", "newington", "vernon", "windsor", "wethersfield", "greenwich", "fairfield", "trumbull", "wallingford", "cheshire", "east haven", "newtown", "mansfield", "windham", "plainville", "north haven", "willimantic", "ridgefield", "branford", "rocky hill", "darien", "westport"],
    "DE": ["wilmington", "dover", "newark", "middletown", "bear", "brookside", "glasgow", "hockessin", "pike creek", "smyrna", "milford", "claymont", "edgemoor", "seaford", "georgetown", "elsmere", "new castle", "pike creek valley", "north star", "wilmington manor", "dover base housing", "camden", "millsboro", "townsend", "lewes", "milton", "harrington", "laurel", "rehoboth beach", "rising sun-lebanon", "delaware city", "bridgeville", "delmar", "greenwood", "highland acres", "cheswold", "newport", "felton", "ocean view", "blades", "selbyville", "bellefonte", "frankford", "clayton", "bethany beach", "slaughter beach", "dewey beach", "fenwick island", "south bethany", "arden"],
    "FL": ["jacksonville", "miami", "tampa", "orlando", "st. petersburg", "hialeah", "port st. lucie", "cape coral", "tallahassee", "fort lauderdale", "pembroke pines", "hollywood", "miramar", "gainesville", "coral springs", "miami gardens", "clearwater", "palm bay", "pompano beach", "west palm beach", "lakeland", "davie", "miami beach", "boca raton", "deltona", "plantation", "sunrise", "palm coast", "pine hills", "deerfield beach", "largo", "melbourne", "boynton beach", "lauderhill", "weston", "fort myers", "kissimmee", "homestead", "tamarac", "delray beach", "daytona beach", "north miami", "wellington", "north port", "jupiter", "ocala", "port orange", "margate", "coconut creek", "sanford"],
    "GA": ["atlanta", "columbus", "augusta", "macon", "savannah", "athens", "sandy springs", "roswell", "johns creek", "albany", "warner robins", "alpharetta", "marietta", "valdosta", "smyrna", "stonecrest", "dunwoody", "south fulton", "brookhaven", "peachtree corners", "east point", "gainesville", "newnan", "milton", "rome", "peachtree city", "hinesville", "dalton", "douglasville", "kennesaw", "lawrenceville", "redan", "woodstock", "north druid hills", "tucker", "candler-mcafee", "la grange", "carrollton", "mableton", "griffin", "belvedere park", "statesboro", "stockbridge", "decatur", "union city", "sugar hill", "mcdonough", "acworth", "martinez", "north decatur"],
    "HI": ["honolulu", "east honolulu", "pearl city", "hilo", "kailua", "waipahu", "kaneohe", "mililani town", "kahului", "ewa gentry", "kihei", "mililani mauka", "makakilo", "wahiawa", "schofield barracks", "waimalu", "halawa", "nanakuli", "waianae", "royal kunia", "wailuku", "aiea", "makaha", "kapaa", "kahalu'u", "waihee-waiehu", "hawaiian paradise park", "waimea", "kailua-kona", "haiku-pauwela", "lahaina", "pukalani", "ewa beach", "kapolei", "makawao", "holualoa", "mountain view", "ahuimanu", "ocean pointe", "napili-honokowai", "kalaheo", "waipio", "waikoloa village", "waipio acres", "kula", "hawaiian beaches", "hickam housing", "iroquois point", "honaunau-napoopoo", "captain cook"],
    "ID": ["boise", "meridian", "nampa", "idaho falls", "pocatello", "caldwell", "coeur d'alene", "twin falls", "post falls", "lewiston", "rexburg", "eagle", "moscow", "kuna", "ammon", "mountain home", "chubbuck", "burley", "hailey", "garden city", "jerome", "blackfoot", "sandpoint", "middleton", "star", "payette", "rathdrum", "emmett", "hayden", "rupert", "preston", "weiser", "rigby", "lincoln", "fruitland", "soda springs", "kimberly", "homedale", "priest river", "american falls", "shelley", "buhl", "filer", "gooding", "teton", "sun valley", "kellogg", "mountain home afb", "mccall", "grangeville"],
    "IL": ["chicago", "aurora", "naperville", "joliet", "rockford", "springfield", "elgin", "peoria", "champaign", "waukegan", "cicero", "bloomington", "arlington heights", "evanston", "decatur", "schaumburg", "bolingbrook", "palatine", "skokie", "des plaines", "orland park", "tinley park", "oak lawn", "berwyn", "mount prospect", "normal", "wheaton", "hoffman estates", "oak park", "downers grove", "elmhurst", "glenview", "dekalb", "lombard", "belleville", "moline", "buffalo grove", "bartlett", "urbana", "quincy", "crystal lake", "plainfield", "streamwood", "carol stream", "romeoville", "rock island", "hanover park", "carpentersville", "wheeling", "park ridge"],
    "IN": ["indianapolis", "fort wayne", "evansville", "south bend", "carmel", "fishers", "bloomington", "hammond", "gary", "muncie", "lafayette", "terre haute", "kokomo", "anderson", "noblesville", "greenwood", "elkhart", "mishawaka", "lawrence", "jeffersonville", "columbus", "portage", "westfield", "valparaiso", "goshen", "new albany", "richmond", "greenfield", "franklin", "plainfield", "michigan city", "granger", "marion", "hobart", "crown point", "merrillville", "schererville", "clarksville", "west lafayette", "east chicago", "logansport", "la porte", "zionsville", "new castle", "vincennes", "seymour", "brownsburg", "shelbyville", "highland", "bedford"],
    "IA": ["des moines", "cedar rapids", "davenport", "sioux city", "iowa city", "waterloo", "council bluffs", "ames", "west des moines", "dubuque", "ankeny", "urbandale", "cedar falls", "marion", "bettendorf", "mason city", "marshalltown", "clinton", "burlington", "ottumwa", "fort dodge", "muscatine", "coralville", "johnston", "north liberty", "altoona", "newton", "indianola", "waukee", "clive", "spencer", "carroll", "boone", "oskaloosa", "grinnell", "pella", "pleasant hill", "keokuk", "waverly", "storm lake", "fairfield", "norwalk", "washington", "le mars", "decorah", "perry", "eldridge", "sioux center", "charles city", "webster city"],
    "KS": ["wichita", "overland park", "kansas city", "olathe", "topeka", "lawrence", "shawnee", "manhattan", "lenexa", "salina", "hutchinson", "leavenworth", "leawood", "dodge city", "garden city", "junction city", "emporia", "derby", "prairie village", "hays", "liberal", "gardner", "pittsburg", "newton", "great bend", "mcpherson", "el dorado", "ottawa", "andover", "merriam", "arkansas city", "atchison", "haysville", "lansing", "coffeyville", "fort riley north", "parsons", "winfield", "roeland park", "augusta", "chanute", "independence", "fort riley cdp", "wellington", "ulysses", "paola", "abilene", "bonner springs", "park city", "maize"],
    "KY": ["louisville", "lexington", "bowling green", "owensboro", "covington", "hopkinsville", "richmond", "florence", "georgetown", "elizabethtown", "henderson", "jeffersontown", "nicholasville", "frankfort", "paducah", "independence", "radcliff", "ashland", "madisonville", "murray", "winchester", "st. matthews", "erlanger", "danville", "fort thomas", "newport", "shively", "shelbyville", "glasgow", "bardstown", "shepherdsville", "somerset", "newburg", "lyndon", "pleasure ridge park", "valley station", "okolona", "fern creek", "highview", "buechel", "burlington", "mount washington", "fairdale", "berea", "ft. campbell north", "campbellsville", "meads", "lebanon", "middlesborough", "mayfield"],
    "LA": ["new orleans", "baton rouge", "shreveport", "lafayette", "lake charles", "kenner", "bossier city", "monroe", "alexandria", "houma", "new iberia", "central", "slidell", "prairieville", "laplace", "metairie", "marrero", "ruston", "sulphur", "hammond", "natchitoches", "zachary", "opelousas", "thibodaux", "gretna", "chalmette", "terrytown", "shenandoah", "harvey", "estelle", "baker", "mandeville", "bayou cane", "claiborne", "covington", "bogalusa", "west monroe", "pineville", "minden", "deridder", "morgan city", "crowley", "abbeville", "waggaman", "westwego", "luling", "woodmere", "gardere", "moss bluff", "merrydale"],
    "ME": ["portland", "lewiston", "bangor", "south portland", "auburn", "biddeford", "sanford", "saco", "augusta", "westbrook", "waterville", "presque isle", "brunswick", "scarborough", "gorham", "york", "kennebunk", "windham", "topsham", "bath", "old orchard beach", "brewer", "falmouth", "caribou", "cape elizabeth", "kittery", "ellsworth", "buxton", "lisbon", "rockland", "old town", "gardiner", "freeport", "orono", "standish", "wells", "rumford", "hampden", "houlton", "yarmouth", "gray", "berwick", "belfast", "cumberland", "winslow", "oakland", "hermon", "arundel", "fairfield", "holden"],
    "MD": ["baltimore", "columbia", "germantown", "silver spring", "waldorf", "glen burnie", "ellicott city", "frederick", "dundalk", "rockville", "bethesda", "gaithersburg", "bowie", "hagerstown", "annapolis", "towson", "salisbury", "carney", "parkville", "wheaton", "aspen hill", "north bethesda", "potomac", "clinton", "south laurel", "chillum", "severn", "odenton", "catonsville", "essex", "olney", "montgomery village", "woodlawn", "north potomac", "lochearn", "perry hall", "pikesville", "college park", "milford mill", "randallstown", "severna park", "middle river", "eldersburg", "westminster", "cumberland", "oxon hill", "fort washington", "greenbelt", "laurel", "cambridge"],
    "MA": ["boston", "worcester", "springfield", "cambridge", "lowell", "brockton", "new bedford", "quincy", "lynn", "fall river", "newton", "lawrence", "somerville", "framingham", "haverhill", "waltham", "malden", "brookline", "plymouth", "medford", "taunton", "chicopee", "weymouth", "revere", "peabody", "methuen", "barnstable", "pittsfield", "attleboro", "arlington", "everett", "salem", "westfield", "leominster", "fitchburg", "beverly", "holyoke", "marlborough", "woburn", "chelsea", "braintree", "shrewsbury", "amherst", "dartmouth", "chelmsford", "andover", "natick", "randolph", "watertown", "franklin"],
    "MI": ["detroit", "grand rapids", "warren", "sterling heights", "ann arbor", "lansing", "flint", "dearborn", "livonia", "troy", "westland", "farmington hills", "kalamazoo", "wyoming", "southfield", "rochester hills", "taylor", "pontiac", "st. clair shores", "royal oak", "novi", "dearborn heights", "battle creek", "saginaw", "kentwood", "east lansing", "roseville", "portage", "midland", "lincoln park", "muskegon", "eastpointe", "ypsilanti", "allen park", "jackson", "inkster", "garden city", "bay city", "southgate", "port huron", "monroe", "mount pleasant", "auburn hills", "wyandotte", "walker", "holland", "redford", "burton", "madison heights"],
    "MN": ["minneapolis", "st. paul", "rochester", "duluth", "bloomington", "brooklyn park", "plymouth", "woodbury", "maple grove", "blaine", "st. cloud", "lakeville", "eagan", "burnsville", "eden prairie", "coon rapids", "minnetonka", "edina", "st. louis park", "moorhead", "mankato", "maplewood", "shakopee", "richfield", "cottage grove", "roseville", "inver grove heights", "brooklyn center", "andover", "savage", "fridley", "apple valley", "ramsey", "owatonna", "chaska", "champlin", "farmington", "prior lake", "elk river", "anoka", "chanhassen", "winona", "oakdale", "hastings", "austin", "faribault", "crystal", "shoreview", "white bear lake", "northfield"],
    "MS": ["jackson", "gulfport", "southaven", "hattiesburg", "biloxi", "meridian", "tupelo", "olive branch", "greenville", "horn lake", "clinton", "pearl", "madison", "ridgeland", "starkville", "columbus", "vicksburg", "pascagoula", "brandon", "oxford", "gautier", "laurel", "ocean springs", "clarksdale", "natchez", "grenada", "corinth", "greenwood", "byram", "long beach", "mccomb", "hernando", "yazoo city", "brookhaven", "canton", "cleveland", "picayune", "moss point", "petal", "d'iberville", "west point", "indianola", "batesville", "bay st. louis", "senatobia", "amory", "waveland", "philadelphia", "booneville", "pontotoc"],
    "MO": ["kansas city", "st. louis", "springfield", "columbia", "independence", "lee's summit", "o'fallon", "st. joseph", "st. charles", "st. peters", "blue springs", "florissant", "joplin", "chesterfield", "jefferson city", "cape girardeau", "wentzville", "wildwood", "university city", "ballwin", "raytown", "liberty", "kirkwood", "gladstone", "mehlville", "oakville", "maryland heights", "hazelwood", "sedalia", "webster groves", "belton", "nixa", "lemay", "grandview", "sikeston", "arnold", "concord", "ferguson", "raymore", "affton", "spanish lake", "rolla", "hannibal", "poplar bluff", "warrensburg", "fulton", "ozark", "farmington", "fort leonard wood", "creve coeur"],
    "MT": ["billings", "missoula", "great falls", "bozeman", "butte", "helena", "kalispell", "havre", "anaconda", "miles city", "belgrade", "livingston", "laurel", "whitefish", "lewistown", "sidney", "glendive", "columbia falls", "polson", "hamilton", "hardin", "dillon", "orchard homes", "wolf point", "evergreen", "lockwood", "four corners", "malmstrom afb", "browning", "lame deer", "east missoula", "colstrip", "crow agency", "bigfork", "cut bank", "forsyth", "deer lodge", "red lodge", "baker", "big timber", "ronan", "conrad", "plentywood", "thompson falls", "glasgow", "terry", "stevensville", "park city", "fort benton", "choteau"],
    "NE": ["omaha", "lincoln", "bellevue", "grand island", "kearney", "fremont", "hastings", "norfolk", "columbus", "papillion", "north platte", "la vista", "scottsburgh", "south sioux city", "beatrice", "lexington", "chalco", "alliance", "gering", "york", "mccook", "blair", "nebraska city", "ralston", "seward", "sidney", "crete", "offutt afb", "plattsmouth", "schuyler", "wayne", "holdrege", "auburn", "chadron", "falls city", "ogallala", "waverly", "gretna", "central city", "geneva", "broken bow", "fairbury", "aurora", "o'neill", "west point", "ashland", "valentine", "david city", "madison", "gothenburg"],
    "NV": ["las vegas", "henderson", "reno", "north las vegas", "sparks", "carson city", "fernley", "elko", "mesquite", "boulder city", "fallon", "winnemucca", "west wendover", "ely", "yerington", "carlin", "lovelock", "wells", "spring creek", "pahrump", "sunrise manor", "paradise", "spring valley", "enterprise", "whitney", "winchester", "summerlin south", "sun valley", "spanish springs", "cold springs", "gardnerville ranchos", "dayton", "golden valley", "incline village", "moapa valley", "laughlin", "lemmon valley", "johnson lane", "silver springs", "minden", "gardnerville", "indian hills", "kingsbury", "nellis afb", "verdi", "sandy valley", "tonopah", "searchlight", "hawthorne"],
    "NH": ["manchester", "nashua", "concord", "derry", "dover", "rochester", "salem", "merrimack", "londonderry", "hudson", "keene", "bedford", "portsmouth", "goffstown", "laconia", "hampton", "milford", "durham", "exeter", "windham", "hooksett", "pelham", "hanover", "claremont", "lebanon", "somersworth", "amherst", "raymond", "seabrook", "hollis", "bow", "litchfield", "conway", "barrington", "newmarket", "weare", "pembroke", "stratham", "hampstead", "berlin", "swanzey", "franklin", "farmington", "plaistow", "belmont", "kingston", "sandown", "new london", "epping", "nottingham"],
    "NJ": ["newark", "jersey city", "paterson", "elizabeth", "edison", "woodbridge", "lakewood", "toms river", "hamilton", "trenton", "clifton", "camden", "brick", "cherry hill", "passaic", "union city", "old bridge", "gloucester", "bayonne", "east orange", "vineland", "franklin", "north bergen", "union", "piscataway", "perth amboy", "hoboken", "west new york", "plainfield", "hackensack", "sayreville", "kearny", "linden", "atlantic city", "fort lee", "fair lawn", "long branch", "garfield", "willingboro", "parsippany-troy hills", "ridgewood", "montclair", "manalapan", "irvington", "jackson", "middletown", "marlboro", "monroe", "pemberton", "evesham"],
    "NM": ["albuquerque", "las cruces", "rio rancho", "santa fe", "roswell", "farmington", "south valley", "clovis", "hobbs", "alamogordo", "carlsbad", "gallup", "deming", "los lunas", "chaparral", "sunland park", "las vegas", "artesia", "lovington", "silver city", "portales", "española", "anthony", "aztec", "los alamos", "grants", "socorro", "ruidoso", "bloomfield", "shiprock", "bernalillo", "belen", "north valley", "corrales", "raton", "truth or consequences", "zuni pueblo", "bosque farms", "kirtland", "eldorado at santa fe", "white rock", "lee acres", "enchanted hills", "tucumcari", "ohkay owingeh", "taos", "laguna", "santa teresa", "lea acres", "edgewood"],
    "NY": ["new york city", "nyc", "buffalo", "rochester", "yonkers", "syracuse", "albany", "new rochelle", "mount vernon", "schenectady", "utica", "white plains", "hempstead", "troy", "niagara falls", "binghamton", "freeport", "valley stream", "long beach", "rome", "north tonawanda", "levittown", "jamestown", "hicksville", "oceanside", "west babylon", "massapequa", "port chester", "poughkeepsie", "middletown", "saratoga springs", "lindenhurst", "east meadow", "elmira", "commack", "west islip", "franklin square", "newburgh", "spring valley", "harrison", "coram", "mamaroneck", "bethpage", "dix hills", "rockville centre", "centereach", "brentwood", "auburn", "ithaca", "plainview", "watertown"],
    "NC": ["charlotte", "raleigh", "greensboro", "durham", "winston-salem", "fayetteville", "cary", "wilmington", "high point", "concord", "greenville", "asheville", "gastonia", "jacksonville", "chapel hill", "rocky mount", "burlington", "huntersville", "wilson", "kannapolis", "apex", "hickory", "wake forest", "indian trail", "goldsboro", "mooresville", "monroe", "salisbury", "holly springs", "matthews", "new bern", "sanford", "cornelius", "garner", "mint hill", "carrboro", "thomasville", "lumberton", "statesville", "asheboro", "kernersville", "clemmons", "shelby", "fuquay-varina", "kinston", "clayton", "morrisville", "lexington", "havelock", "elizabeth city"],
    "ND": ["fargo", "bismarck", "grand forks", "minot", "west fargo", "williston", "dickinson", "mandan", "jamestown", "wahpeton", "devils lake", "valley city", "watford city", "grafton", "lincoln", "minot afb", "horace", "beulah", "rugby", "stanley", "bottineau", "hazen", "casselton", "lisbon", "mayville", "new town", "oakes", "park river", "belcourt", "carrington", "tioga", "bowman", "thompson", "washburn", "harvey", "hillsboro", "cooperstown", "langdon", "beach", "garrison", "crosby", "cavalier", "surrey", "harwood", "velva", "medora", "larimore", "steele", "napoleon", "mcclusky"],
    "OH": ["columbus", "cleveland", "cincinnati", "toledo", "akron", "dayton", "parma", "canton", "youngstown", "lorain", "hamilton", "springfield", "kettering", "elyria", "lakewood", "cuyahoga falls", "middletown", "euclid", "newark", "mansfield", "mentor", "beavercreek", "cleveland heights", "strongsville", "fairfield", "dublin", "warren", "findlay", "lancaster", "lima", "huber heights", "westerville", "marion", "grove city", "reynoldsburg", "stow", "gahanna", "westlake", "chillicothe", "delaware", "upper arlington", "boardman", "mason", "north olmsted", "brunswick", "north ridgeville", "north royalton", "bowling green", "kent", "hilliard"],
    "OK": ["oklahoma city", "tulsa", "norman", "broken arrow", "edmond", "lawton", "moore", "midwest city", "stillwater", "enid", "muskogee", "bartlesville", "owasso", "shawnee", "ponca city", "ardmore", "duncan", "bixby", "del city", "yukon", "durant", "sapulpa", "claremore", "mustang", "mcalester", "sand springs", "jenks", "el reno", "altus", "bethany", "ada", "chickasha", "miami", "guthrie", "guymon", "tahlequah", "woodward", "okmulgee", "weatherford", "warr acres", "elk city", "blanchard", "pryor creek", "choctaw", "cushing", "sallisaw", "clinton", "glenpool", "pauls valley", "coweta"],
    "OR": ["portland", "salem", "eugene", "gresham", "hillsboro", "beaverton", "bend", "medford", "springfield", "corvallis", "albany", "tigard", "lake oswego", "keizer", "grants pass", "oregon city", "mcminnville", "redmond", "tualatin", "west linn", "woodburn", "forest grove", "newberg", "wilsonville", "roseburg", "klamath falls", "ashland", "milwaukie", "sherwood", "happy valley", "central point", "canby", "hermiston", "pendleton", "lebanon", "coos bay", "troutdale", "the dalles", "dallas", "st. helens", "la grande", "altamont", "bethany", "oak grove", "monmouth", "hayesville", "four corners", "cornelius", "ontario", "oatfield"],
    "PA": ["philadelphia", "pittsburgh", "allentown", "reading", "erie", "scranton", "bethlehem", "lancaster", "harrisburg", "altoona", "york", "state college", "wilkes-barre", "chester", "williamsport", "lebanon", "hazleton", "easton", "king of prussia", "norristown", "johnstown", "mckeesport", "hermitage", "pottstown", "butler", "chambersburg", "bethel park", "monroeville", "new castle", "wilkinsburg", "plum", "mount lebanon", "levittown", "lower merion", "upper darby", "radnor", "drexel hill", "carlisle", "phoenixville", "west chester", "lansdale", "penn hills", "allison park", "west mifflin", "murrysville", "hanover", "baldwin", "coatesville", "indiana", "washington"],
    "RI": ["providence", "warwick", "cranston", "pawtucket", "east providence", "woonsocket", "coventry", "cumberland", "north providence", "south kingstown", "west warwick", "johnston", "north kingstown", "newport", "bristol", "westerly", "barrington", "smithfield", "lincoln", "central falls", "portsmouth", "middletown", "burrillville", "narragansett", "tiverton", "east greenwich", "valley falls", "warren", "greenville", "north smithfield", "wakefield-peacedale", "scituate", "kingston", "hopkinton", "charlestown", "exeter", "richmond", "west greenwich", "glocester", "jamestown", "little compton", "new shoreham", "foster", "ashaway", "bradford", "pascoag", "chepachet", "harmony", "hope valley"],
    "SC": ["charleston", "columbia", "north charleston", "mount pleasant", "rock hill", "greenville", "summerville", "sumter", "goose creek", "hilton head island", "florence", "spartanburg", "myrtle beach", "aiken", "anderson", "greer", "mauldin", "greenwood", "north augusta", "easley", "simpsonville", "hanahan", "lexington", "conway", "west columbia", "north myrtle beach", "clemson", "orangeburg", "cayce", "fort mill", "bluffton", "port royal", "irmo", "socastee", "gaffney", "beaufort", "tega cay", "wade hampton", "five forks", "ladson", "st. andrews", "taylors", "gantt", "dentsville", "berea", "parker", "red hill", "forestbrook", "sans souci", "seven oaks"],
    "SD": ["sioux falls", "rapid city", "aberdeen", "brookings", "watertown", "mitchell", "yankton", "pierre", "huron", "spearfish", "vermillion", "brandon", "box elder", "madison", "sturgis", "belle fourche", "harrisburg", "tea", "dell rapids", "canton", "lead", "chamberlain", "beresford", "hot springs", "lennox", "mobridge", "winner", "sisseton", "wagner", "deadwood", "milbank", "redfield", "custer", "gregory", "north sioux city", "flandreau", "platte", "volga", "arlington", "parker", "webster", "clark", "alcester", "elk point", "north spearfish", "gettysburg", "crooks", "freeman", "garretson", "tyndall"],
    "TN": ["nashville", "memphis", "knoxville", "chattanooga", "clarksville", "murfreesboro", "franklin", "jackson", "johnson city", "bartlett", "hendersonville", "kingsport", "collierville", "cleveland", "smyrna", "germantown", "brentwood", "columbia", "spring hill", "la vergne", "gallatin", "cookeville", "mount juliet", "lebanon", "morristown", "oak ridge", "maryville", "east ridge", "greeneville", "tullahoma", "dyersburg", "bloomingdale", "bristol", "shelbyville", "athens", "dickson", "mcminnville", "farragut", "soddy-daisy", "goodlettsville", "sevierville", "elizabethton", "portland", "millington", "red bank", "lakeland", "winchester", "crossville", "union city", "lewisburg"],
    "TX": ["houston", "san antonio", "dallas", "austin", "fort worth", "el paso", "arlington", "corpus christi", "plano", "laredo", "lubbock", "garland", "irving", "amarillo", "grand prairie", "mckinney", "brownsville", "frisco", "pasadena", "killeen", "mesquite", "mcallen", "waco", "carrollton", "denton", "midland", "abilene", "beaumont", "round rock", "odessa", "wichita falls", "richardson", "lewisville", "tyler", "college station", "pearland", "san angelo", "allen", "league city", "sugar land", "longview", "edinburg", "mission", "bryan", "baytown", "pharr", "temple", "missouri city", "flower mound", "harlingen"],
    "UT": ["salt lake city", "slc", "west valley city", "west jordan", "provo", "orem", "sandy", "ogden", "st. george", "layton", "taylorsville", "south jordan", "lehi", "logan", "murray", "draper", "bountiful", "riverton", "roy", "spanish fork", "pleasant grove", "kearns", "cottonwood heights", "springville", "herriman", "eagle mountain", "tooele", "cedar city", "kaysville", "clearfield", "midvale", "american fork", "holladay", "syracuse", "south salt lake", "saratoga springs", "magna", "washington", "clinton", "north ogden", "payson", "west haven", "millcreek", "highland", "brigham city", "farmington", "heber city", "centerville", "hurricane", "south ogden", "smithfield"],
    "VT": ["burlington", "south burlington", "rutland", "essex junction", "barre", "montpelier", "winooski", "st. albans", "newport", "vergennes", "colchester", "bennington", "brattleboro", "milton", "hartford", "williston", "middlebury", "springfield", "swanton", "st. johnsbury", "shelburne", "bellows falls", "lyndon", "northfield", "poultney", "fair haven", "morristown", "bristol", "brandon", "waterbury", "randolph", "enosburg falls", "jericho", "richmond", "castleton", "derby", "hinesburg", "johnson", "stowe", "manchester", "essex", "fairfax", "georgia", "hardwick", "windsor", "ludlow", "barton", "woodstock", "orleans", "montgomery"],
    "VA": ["virginia beach", "norfolk", "chesapeake", "richmond", "newport news", "alexandria", "hampton", "roanoke", "portsmouth", "suffolk", "lynchburg", "harrisonburg", "leesburg", "charlottesville", "blacksburg", "danville", "manassas", "petersburg", "centreville", "tuckahoe", "dale city", "mechanicsville", "winchester", "reston", "mclean", "cave spring", "burke", "west falls church", "tysons", "lake ridge", "springfield", "herndon", "oakton", "hopewell", "chester", "sterling", "annandale", "woodbridge", "christiansburg", "staunton", "colonial heights", "bailey's crossroads", "ashburn", "fredericksburg", "salem", "fair oaks", "linton hall", "rose hill", "franconia", "west springfield"],
    "WA": ["seattle", "spokane", "tacoma", "vancouver", "bellevue", "kent", "everett", "renton", "spokane valley", "federal way", "yakima", "kirkland", "bellingham", "kennewick", "auburn", "pasco", "marysville", "lakewood", "redmond", "shoreline", "richland", "sammamish", "burien", "olympia", "lacey", "edmonds", "bremerton", "puyallup", "bothell", "south hill", "wenatchee", "mount vernon", "longview", "issaquah", "university place", "walla walla", "lynnwood", "pullman", "des moines", "lake stevens", "seatac", "parkland", "cottage lake", "mercer island", "east hill-meridian", "bryn mawr-skyway", "maltby", "spanaway", "silver firs", "orchards"],
    "WV": ["charleston", "huntington", "morgantown", "parkersburg", "wheeling", "weirton", "fairmont", "martinsburg", "beckley", "clarksburg", "south charleston", "st. albans", "vienna", "bluefield", "moundsville", "bridgeport", "oak hill", "dunbar", "elkins", "nitro", "hurricane", "princeton", "charles town", "teays valley", "westover", "buckhannon", "pea ridge", "cheat lake", "grafton", "cross lanes", "point pleasant", "culloden", "keyser", "ranson", "summersville", "new martinsville", "inwood", "ravenswood", "brookhaven", "sistersville", "lewisburg", "williamson", "weston", "logan", "paden city", "kingwood", "madison", "wellsberg", "salem", "glenville"],
    "WI": ["milwaukee", "madison", "green bay", "kenosha", "racine", "appleton", "waukesha", "eau claire", "oshkosh", "janesville", "west allis", "la crosse", "sheboygan", "wauwatosa", "fond du lac", "new berlin", "wausau", "brookfield", "greenfield", "beloit", "franklin", "oak creek", "manitowoc", "west bend", "sun prairie", "superior", "fitchburg", "stevens point", "neenah", "menomonee falls", "muskego", "middleton", "de pere", "south milwaukee", "pleasant prairie", "caledonia", "marshfield", "menomonee", "wisconsin rapids", "beaver dam", "watertown", "whitewater", "germantown", "fort atkinson", "cudahy", "ashwaubenon", "onalaska", "menasha", "howard", "little chute"],
    "WY": ["cheyenne", "casper", "laramie", "gillette", "rock springs", "sheridan", "green river", "evanston", "riverton", "jackson", "cody", "rawlins", "lander", "torrington", "powell", "douglas", "worland", "buffalo", "newcastle", "wheatland", "thermopolis", "afton", "pinedale", "lyman", "mountain view", "kemmerer", "lovell", "south greeley", "ranchettes", "fox farm-college", "evansville", "bar nunn", "glenrock", "mills", "saratoga", "ranchester", "pine bluffs", "wright", "diamondville", "basin", "hoback", "moose wilson road", "star valley ranch", "upton", "lusk", "sundance", "greybull", "teton village", "guernsey", "antelope valley-crestview"]
};

// ... existing code ...

const extractTextFromPdf = async (file: File): Promise<string> => {
    // ... existing code ...
    return ""; // Stubbed as per previous implementation logic in actual file
};

// New function to parse Amazon Associates Report
export const parseAmazonReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    const text = await readFileAsText(file);
    const lines = text.split('\n');
    const metrics: AmazonMetric[] = [];

    // Header Mapping strategy
    // Typical headers: "Date", "Tracking ID", "ASIN", "Title", "Category", "Clicks", "Ordered Items", "Shipped Items", "Returned Items", "Conversion", "Shipped Items Revenue", "Bonus", "Total Earnings"
    if (lines.length < 2) return [];

    // Find header line (it might not be the first line)
    const headerIndex = lines.findIndex(l => l.toLowerCase().includes('asin') && l.toLowerCase().includes('earnings'));
    if (headerIndex === -1) {
        throw new Error("Invalid Amazon Report format. Could not find header row with 'ASIN' and 'Earnings'.");
    }

    const header = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    
    const colMap = {
        date: header.findIndex(h => h === 'date'),
        asin: header.findIndex(h => h === 'asin'),
        title: header.findIndex(h => h === 'product title' || h === 'title'),
        clicks: header.findIndex(h => h === 'clicks'),
        ordered: header.findIndex(h => h === 'ordered items'),
        shipped: header.findIndex(h => h === 'shipped items'),
        revenue: header.findIndex(h => h.includes('earnings') || h.includes('commission') || h.includes('bounties')), // Use Total Earnings usually
        conversion: header.findIndex(h => h.includes('conversion')),
        tracking: header.findIndex(h => h.includes('tracking id')),
        category: header.findIndex(h => h === 'category' || h === 'product group')
    };

    if (colMap.asin === -1 || colMap.revenue === -1) {
         throw new Error("Missing critical columns (ASIN or Earnings).");
    }

    // Process rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV split respecting quotes
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        
        if (values.length < header.length) continue;

        const dateStr = colMap.date > -1 ? values[colMap.date] : new Date().toISOString().split('T')[0];
        
        // Skip summary rows (often don't have ASIN or valid date)
        if (!values[colMap.asin] || values[colMap.asin].length < 5) continue;

        const parseNum = (idx: number) => {
            if (idx === -1) return 0;
            const val = values[idx].replace(/[$,%]/g, '');
            return parseFloat(val) || 0;
        }

        const metric: AmazonMetric = {
            id: generateUUID(),
            date: dateStr,
            asin: values[colMap.asin],
            title: colMap.title > -1 ? values[colMap.title] : 'Unknown Product',
            clicks: parseNum(colMap.clicks),
            orderedItems: parseNum(colMap.ordered),
            shippedItems: parseNum(colMap.shipped),
            revenue: parseNum(colMap.revenue),
            conversionRate: parseNum(colMap.conversion),
            trackingId: colMap.tracking > -1 ? values[colMap.tracking] : 'default',
            category: colMap.category > -1 ? values[colMap.category] : undefined
        };

        metrics.push(metric);
    }

    onProgress(`Parsed ${metrics.length} amazon metrics.`);
    return metrics;
}

// ... existing helper functions (readFileAsText, parseDate, etc) ... 
const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.length < 5) return null; // Avoid tiny strings

    // Try YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
        const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
        if (!isNaN(date.getTime())) return date;
    }
    
    // Try MM-DD-YYYY or MM-DD-YY
    if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        let year = parseInt(parts[2], 10);
        if (year < 100) { // Handle 2-digit year
            year += year < 70 ? 2000 : 1900;
        }
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }

    // Try MM/DD/YY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        let year = parseInt(parts[2], 10);
        if (year < 100) { // Handle 2-digit year
            year += year < 70 ? 2000 : 1900;
        }
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }

    // Fallback for textual dates like "Nov 6, 2025"
    // We add a strict check to ensure it contains a month name or looks date-like
    const hasDateStructure = /[a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4}/.test(dateStr) || /\d{1,2}\s+[a-zA-Z]{3,}\s+\d{4}/.test(dateStr);
    
    if (hasDateStructure) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1990 && date.getFullYear() < 2050) return date;
    }
    
    return null;
}

const extractLocationFromDescription = (description: string): string | undefined => {
    // ... existing implementation ...
    return undefined;
}

// ... existing export const parseTransactionsFromFiles ...
// ... existing export const parseTransactionsFromText ...

// Export existing functions correctly
export { parseTransactionsFromFiles, parseTransactionsFromText };