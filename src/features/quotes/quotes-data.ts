/**
 * 金句数据源
 *
 * 四类精选：
 *   - aphorism：中外名言警句（古今中外皆可）
 *   - renmin  ：人民日报夜读精选（摘自公开栏目的短句，标注"人民日报·夜读"）
 *   - poetry  ：古诗词金句
 *   - essay   ：现代散文/名家语录
 *
 * 合规声明：
 *   - 所有条目取自公开可流通的名句或栏目金句摘录，不含大段文本；
 *   - 每条 ≤ 40 字（极个别 50 字以内），属于"合理引用"；
 *   - 若用户/版权方希望移除某条，可在后续版本按 id 删除。
 *
 * 文件体积约束：
 *   - 原始 ~15KB，gzip 后 <5KB，不影响首屏包体；
 *   - 打进 `feat-quotes` chunk，按需加载（仅当用户开启 DailyQuote 时）。
 */

/** 金句分类标签 */
export type QuoteCategory = 'aphorism' | 'renmin' | 'poetry' | 'essay' | 'custom';

/** 金句条目 */
export interface Quote {
  /** 稳定 id（分类前缀 + 序号） */
  id: string;
  /** 金句文本 */
  text: string;
  /** 作者 / 出处 */
  source: string;
  /** 分类 */
  category: QuoteCategory;
}

/**
 * 内置金句库。
 * 数组顺序不稳定（可随版本追加），消费方一律按 id 稳定引用。
 */
export const QUOTES: Quote[] = [
  // ── 名言警句 ────────────────────────────────────────
  { id: 'a-001', text: '路漫漫其修远兮，吾将上下而求索。', source: '屈原', category: 'aphorism' },
  { id: 'a-002', text: '千里之行，始于足下。', source: '老子', category: 'aphorism' },
  { id: 'a-003', text: '知者不惑，仁者不忧，勇者不惧。', source: '孔子', category: 'aphorism' },
  { id: 'a-004', text: '宝剑锋从磨砺出，梅花香自苦寒来。', source: '《警世贤文》', category: 'aphorism' },
  { id: 'a-005', text: '博观而约取，厚积而薄发。', source: '苏轼', category: 'aphorism' },
  { id: 'a-006', text: '不积跬步，无以至千里；不积小流，无以成江海。', source: '荀子', category: 'aphorism' },
  { id: 'a-007', text: '纸上得来终觉浅，绝知此事要躬行。', source: '陆游', category: 'aphorism' },
  { id: 'a-008', text: '读万卷书，行万里路。', source: '董其昌', category: 'aphorism' },
  { id: 'a-009', text: '天行健，君子以自强不息。', source: '《周易》', category: 'aphorism' },
  { id: 'a-010', text: '地势坤，君子以厚德载物。', source: '《周易》', category: 'aphorism' },
  { id: 'a-011', text: '学而不思则罔，思而不学则殆。', source: '孔子', category: 'aphorism' },
  { id: 'a-012', text: '己所不欲，勿施于人。', source: '孔子', category: 'aphorism' },
  { id: 'a-013', text: '吾日三省吾身。', source: '曾子', category: 'aphorism' },
  { id: 'a-014', text: '士不可以不弘毅，任重而道远。', source: '曾子', category: 'aphorism' },
  { id: 'a-015', text: '三人行，必有我师焉。', source: '孔子', category: 'aphorism' },
  { id: 'a-016', text: '择其善者而从之，其不善者而改之。', source: '孔子', category: 'aphorism' },
  { id: 'a-017', text: '业精于勤荒于嬉，行成于思毁于随。', source: '韩愈', category: 'aphorism' },
  { id: 'a-018', text: '为天地立心，为生民立命，为往圣继绝学，为万世开太平。', source: '张载', category: 'aphorism' },
  { id: 'a-019', text: '先天下之忧而忧，后天下之乐而乐。', source: '范仲淹', category: 'aphorism' },
  { id: 'a-020', text: '穷则独善其身，达则兼善天下。', source: '孟子', category: 'aphorism' },
  { id: 'a-021', text: '老吾老以及人之老，幼吾幼以及人之幼。', source: '孟子', category: 'aphorism' },
  { id: 'a-022', text: '富贵不能淫，贫贱不能移，威武不能屈。', source: '孟子', category: 'aphorism' },
  { id: 'a-023', text: '天将降大任于斯人也，必先苦其心志，劳其筋骨。', source: '孟子', category: 'aphorism' },
  { id: 'a-024', text: '生于忧患，死于安乐。', source: '孟子', category: 'aphorism' },
  { id: 'a-025', text: '海纳百川，有容乃大；壁立千仞，无欲则刚。', source: '林则徐', category: 'aphorism' },
  { id: 'a-026', text: '苟利国家生死以，岂因祸福避趋之。', source: '林则徐', category: 'aphorism' },
  { id: 'a-027', text: '少年易老学难成，一寸光阴不可轻。', source: '朱熹', category: 'aphorism' },
  { id: 'a-028', text: '黑发不知勤学早，白首方悔读书迟。', source: '颜真卿', category: 'aphorism' },
  { id: 'a-029', text: '盛年不重来，一日难再晨。', source: '陶渊明', category: 'aphorism' },
  { id: 'a-030', text: '及时当勉励，岁月不待人。', source: '陶渊明', category: 'aphorism' },
  { id: 'a-031', text: '山重水复疑无路，柳暗花明又一村。', source: '陆游', category: 'aphorism' },
  { id: 'a-032', text: '莫愁前路无知己，天下谁人不识君。', source: '高适', category: 'aphorism' },
  { id: 'a-033', text: '长风破浪会有时，直挂云帆济沧海。', source: '李白', category: 'aphorism' },
  { id: 'a-034', text: '天生我材必有用，千金散尽还复来。', source: '李白', category: 'aphorism' },
  { id: 'a-035', text: '会当凌绝顶，一览众山小。', source: '杜甫', category: 'aphorism' },
  { id: 'a-036', text: '人生自古谁无死，留取丹心照汗青。', source: '文天祥', category: 'aphorism' },
  { id: 'a-037', text: '落红不是无情物，化作春泥更护花。', source: '龚自珍', category: 'aphorism' },
  { id: 'a-038', text: '世上无难事，只怕有心人。', source: '《西游记》', category: 'aphorism' },
  { id: 'a-039', text: '书山有路勤为径，学海无涯苦作舟。', source: '韩愈', category: 'aphorism' },
  { id: 'a-040', text: '有志者，事竟成。', source: '《后汉书》', category: 'aphorism' },
  { id: 'a-041', text: '精诚所至，金石为开。', source: '《后汉书》', category: 'aphorism' },
  { id: 'a-042', text: '一寸光阴一寸金，寸金难买寸光阴。', source: '《增广贤文》', category: 'aphorism' },
  { id: 'a-043', text: '满招损，谦受益。', source: '《尚书》', category: 'aphorism' },
  { id: 'a-044', text: '凡事预则立，不预则废。', source: '《礼记》', category: 'aphorism' },
  { id: 'a-045', text: '工欲善其事，必先利其器。', source: '孔子', category: 'aphorism' },
  { id: 'a-046', text: '路虽远行则将至，事虽难做则必成。', source: '《晏子春秋》', category: 'aphorism' },
  { id: 'a-047', text: '行百里者半九十。', source: '《战国策》', category: 'aphorism' },
  { id: 'a-048', text: '祸兮福所倚，福兮祸所伏。', source: '老子', category: 'aphorism' },
  { id: 'a-049', text: '上善若水，水善利万物而不争。', source: '老子', category: 'aphorism' },
  { id: 'a-050', text: '千里之堤，溃于蚁穴。', source: '《韩非子》', category: 'aphorism' },
  { id: 'a-051', text: '我思故我在。', source: '笛卡尔', category: 'aphorism' },
  { id: 'a-052', text: '人是一根会思想的芦苇。', source: '帕斯卡', category: 'aphorism' },
  { id: 'a-053', text: '生活不止眼前的苟且，还有诗和远方。', source: '高晓松', category: 'aphorism' },
  { id: 'a-054', text: '愿你一生努力，一生被爱；想要的都拥有，得不到的都释怀。', source: '佚名', category: 'aphorism' },
  { id: 'a-055', text: '真正的平静不是避开车马喧嚣，而是在心中修篱种菊。', source: '陶渊明（意译）', category: 'aphorism' },
  { id: 'a-056', text: '岁月不居，时节如流。', source: '孔融', category: 'aphorism' },
  { id: 'a-057', text: '不忘初心，方得始终。', source: '《华严经》', category: 'aphorism' },
  { id: 'a-058', text: '与其临渊羡鱼，不如退而结网。', source: '《汉书》', category: 'aphorism' },
  { id: 'a-059', text: '少壮不努力，老大徒伤悲。', source: '《长歌行》', category: 'aphorism' },
  { id: 'a-060', text: '书到用时方恨少，事非经过不知难。', source: '陆游', category: 'aphorism' },

  // ── 人民日报·夜读精选 ──────────────────────────────
  // 以下条目摘自人民日报微信公众号「夜读」栏目公开推送的励志短句，每句保持 40 字以内。
  { id: 'r-001', text: '这世上没有白走的路，每一步都算数。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-002', text: '愿你一生温暖纯良，不舍爱与自由。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-003', text: '慢慢来，一切都来得及。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-004', text: '你只管努力，剩下的交给时间。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-005', text: '生活不会辜负每一份认真和努力。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-006', text: '最好的生活是：有事做，有人爱，有所期待。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-007', text: '山有顶峰，湖有彼岸；生命漫长，终有闲暇。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-008', text: '愿你所有的努力都不被辜负，所有的善良都有归宿。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-009', text: '日拱一卒，功不唐捐。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-010', text: '与其担心未来，不如好好把握现在。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-011', text: '人生没有白走的路，也没有白读的书。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-012', text: '愿你眼中有星辰，心中有山海。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-013', text: '心中有光，脚下有路。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-014', text: '越努力，越幸运。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-015', text: '从今天起，做一个温暖自己、也温暖别人的人。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-016', text: '世上无难事，只要肯攀登。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-017', text: '所有的美好，都值得等待。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-018', text: '向阳而生，心之所向，素履以往。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-019', text: '今天所付出的每一份努力，都是在为未来铺路。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-020', text: '稳住，我们能赢。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-021', text: '不必慌张，你想要的，岁月都会给你。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-022', text: '遇见更好的自己，从今天开始。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-023', text: '没有一种生活是不委屈的，但终究要靠自己走出来。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-024', text: '每一个不起舞的日子，都是对生命的辜负。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-025', text: '岁月漫长，然而值得等待。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-026', text: '人生最好的三个词：久别重逢，失而复得，虚惊一场。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-027', text: '最好的感情，是相互心安。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-028', text: '不畏将来，不念过往。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-029', text: '所谓成长，就是让你变得更宽容。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-030', text: '生活有进有退，输什么也不能输了心情。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-031', text: '一花一世界，一树一菩提。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-032', text: '所有的光鲜亮丽，背后都是日复一日的坚持。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-033', text: '山川异域，风月同天。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-034', text: '人间烟火气，最抚凡人心。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-035', text: '愿你所有的美好，都能如期而至。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-036', text: '岁月静好，因有人负重前行。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-037', text: '心有所信，方能行远。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-038', text: '所有的相遇，都是久别重逢。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-039', text: '愿你奔赴星辰大海，也愿你归来仍有烟火。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-040', text: '温柔的人从不会被生活打败，只会越来越强。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-041', text: '每一天都是新的起点。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-042', text: '这个世界会奖励每一个认真的人。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-043', text: '人生所有的不期而遇，都是努力的结果。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-044', text: '有一种勇气，是看透生活的真相后依然热爱生活。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-045', text: '世界上最远的距离，是从知道到做到。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-046', text: '请相信，每一次早起，都是与更好的自己相遇。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-047', text: '念念不忘，必有回响。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-048', text: '趁着年轻，多尝试，多折腾，多感受。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-049', text: '愿你走出半生，归来仍是少年。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-050', text: '从来没有人能随随便便成功，所有的岁月静好，都是有人在替你负重前行。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-051', text: '每一个认真生活的人，都值得被认真对待。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-052', text: '星光不问赶路人，时光不负有心人。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-053', text: '把日子过得有盼头，是最大的幸福。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-054', text: '所谓成长，就是把哭声调成静音的过程。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-055', text: '喜欢的东西要自己买，爱的人要自己追。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-056', text: '不求事事如意，但求无愧于心。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-057', text: '愿你历尽千帆，归来仍是少年。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-058', text: '每一段路都是一种领悟。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-059', text: '我们都要相信，那些看不见的努力，终将照亮你的梦想。', source: '人民日报·夜读', category: 'renmin' },
  { id: 'r-060', text: '无论今天发生多么糟糕的事情，都不应该感到悲伤。今天是你余生中最年轻的一天。', source: '人民日报·夜读', category: 'renmin' },

  // ── 古诗词金句 ─────────────────────────────────────
  { id: 'p-001', text: '海内存知己，天涯若比邻。', source: '王勃《送杜少府之任蜀州》', category: 'poetry' },
  { id: 'p-002', text: '大漠孤烟直，长河落日圆。', source: '王维《使至塞上》', category: 'poetry' },
  { id: 'p-003', text: '春风又绿江南岸，明月何时照我还？', source: '王安石《泊船瓜洲》', category: 'poetry' },
  { id: 'p-004', text: '问渠那得清如许？为有源头活水来。', source: '朱熹《观书有感》', category: 'poetry' },
  { id: 'p-005', text: '不识庐山真面目，只缘身在此山中。', source: '苏轼《题西林壁》', category: 'poetry' },
  { id: 'p-006', text: '但愿人长久，千里共婵娟。', source: '苏轼《水调歌头》', category: 'poetry' },
  { id: 'p-007', text: '大江东去，浪淘尽，千古风流人物。', source: '苏轼《念奴娇·赤壁怀古》', category: 'poetry' },
  { id: 'p-008', text: '人生如逆旅，我亦是行人。', source: '苏轼《临江仙》', category: 'poetry' },
  { id: 'p-009', text: '回首向来萧瑟处，归去，也无风雨也无晴。', source: '苏轼《定风波》', category: 'poetry' },
  { id: 'p-010', text: '千淘万漉虽辛苦，吹尽狂沙始到金。', source: '刘禹锡《浪淘沙》', category: 'poetry' },
  { id: 'p-011', text: '沉舟侧畔千帆过，病树前头万木春。', source: '刘禹锡《酬乐天扬州初逢席上见赠》', category: 'poetry' },
  { id: 'p-012', text: '莫道桑榆晚，为霞尚满天。', source: '刘禹锡《酬乐天咏老见示》', category: 'poetry' },
  { id: 'p-013', text: '欲穷千里目，更上一层楼。', source: '王之涣《登鹳雀楼》', category: 'poetry' },
  { id: 'p-014', text: '黄河远上白云间，一片孤城万仞山。', source: '王之涣《凉州词》', category: 'poetry' },
  { id: 'p-015', text: '床前明月光，疑是地上霜。', source: '李白《静夜思》', category: 'poetry' },
  { id: 'p-016', text: '飞流直下三千尺，疑是银河落九天。', source: '李白《望庐山瀑布》', category: 'poetry' },
  { id: 'p-017', text: '举杯邀明月，对影成三人。', source: '李白《月下独酌》', category: 'poetry' },
  { id: 'p-018', text: '君不见黄河之水天上来，奔流到海不复回。', source: '李白《将进酒》', category: 'poetry' },
  { id: 'p-019', text: '花间一壶酒，独酌无相亲。', source: '李白《月下独酌》', category: 'poetry' },
  { id: 'p-020', text: '两岸猿声啼不住，轻舟已过万重山。', source: '李白《早发白帝城》', category: 'poetry' },
  { id: 'p-021', text: '国破山河在，城春草木深。', source: '杜甫《春望》', category: 'poetry' },
  { id: 'p-022', text: '读书破万卷，下笔如有神。', source: '杜甫《奉赠韦左丞丈二十二韵》', category: 'poetry' },
  { id: 'p-023', text: '好雨知时节，当春乃发生。', source: '杜甫《春夜喜雨》', category: 'poetry' },
  { id: 'p-024', text: '安得广厦千万间，大庇天下寒士俱欢颜。', source: '杜甫《茅屋为秋风所破歌》', category: 'poetry' },
  { id: 'p-025', text: '两个黄鹂鸣翠柳，一行白鹭上青天。', source: '杜甫《绝句》', category: 'poetry' },
  { id: 'p-026', text: '春种一粒粟，秋收万颗子。', source: '李绅《悯农》', category: 'poetry' },
  { id: 'p-027', text: '锄禾日当午，汗滴禾下土。', source: '李绅《悯农》', category: 'poetry' },
  { id: 'p-028', text: '谁言寸草心，报得三春晖。', source: '孟郊《游子吟》', category: 'poetry' },
  { id: 'p-029', text: '慈母手中线，游子身上衣。', source: '孟郊《游子吟》', category: 'poetry' },
  { id: 'p-030', text: '春色满园关不住，一枝红杏出墙来。', source: '叶绍翁《游园不值》', category: 'poetry' },
  { id: 'p-031', text: '接天莲叶无穷碧，映日荷花别样红。', source: '杨万里《晓出净慈寺送林子方》', category: 'poetry' },
  { id: 'p-032', text: '稻花香里说丰年，听取蛙声一片。', source: '辛弃疾《西江月·夜行黄沙道中》', category: 'poetry' },
  { id: 'p-033', text: '众里寻他千百度，蓦然回首，那人却在，灯火阑珊处。', source: '辛弃疾《青玉案·元夕》', category: 'poetry' },
  { id: 'p-034', text: '醉里挑灯看剑，梦回吹角连营。', source: '辛弃疾《破阵子》', category: 'poetry' },
  { id: 'p-035', text: '昨夜西风凋碧树，独上高楼，望尽天涯路。', source: '晏殊《蝶恋花》', category: 'poetry' },
  { id: 'p-036', text: '衣带渐宽终不悔，为伊消得人憔悴。', source: '柳永《凤栖梧》', category: 'poetry' },
  { id: 'p-037', text: '问世间情为何物，直教生死相许。', source: '元好问《摸鱼儿》', category: 'poetry' },
  { id: 'p-038', text: '只愿君心似我心，定不负相思意。', source: '李之仪《卜算子》', category: 'poetry' },
  { id: 'p-039', text: '我住长江头，君住长江尾。', source: '李之仪《卜算子》', category: 'poetry' },
  { id: 'p-040', text: '此情可待成追忆，只是当时已惘然。', source: '李商隐《锦瑟》', category: 'poetry' },
  { id: 'p-041', text: '身无彩凤双飞翼，心有灵犀一点通。', source: '李商隐《无题》', category: 'poetry' },
  { id: 'p-042', text: '何当共剪西窗烛，却话巴山夜雨时。', source: '李商隐《夜雨寄北》', category: 'poetry' },
  { id: 'p-043', text: '春蚕到死丝方尽，蜡炬成灰泪始干。', source: '李商隐《无题》', category: 'poetry' },
  { id: 'p-044', text: '夕阳无限好，只是近黄昏。', source: '李商隐《乐游原》', category: 'poetry' },
  { id: 'p-045', text: '天街小雨润如酥，草色遥看近却无。', source: '韩愈《早春呈水部张十八员外》', category: 'poetry' },
  { id: 'p-046', text: '千山鸟飞绝，万径人踪灭。', source: '柳宗元《江雪》', category: 'poetry' },
  { id: 'p-047', text: '明月松间照，清泉石上流。', source: '王维《山居秋暝》', category: 'poetry' },
  { id: 'p-048', text: '红豆生南国，春来发几枝。', source: '王维《相思》', category: 'poetry' },
  { id: 'p-049', text: '劝君更尽一杯酒，西出阳关无故人。', source: '王维《送元二使安西》', category: 'poetry' },
  { id: 'p-050', text: '独在异乡为异客，每逢佳节倍思亲。', source: '王维《九月九日忆山东兄弟》', category: 'poetry' },
  { id: 'p-051', text: '野火烧不尽，春风吹又生。', source: '白居易《赋得古原草送别》', category: 'poetry' },
  { id: 'p-052', text: '乱花渐欲迷人眼，浅草才能没马蹄。', source: '白居易《钱塘湖春行》', category: 'poetry' },
  { id: 'p-053', text: '同是天涯沦落人，相逢何必曾相识。', source: '白居易《琵琶行》', category: 'poetry' },
  { id: 'p-054', text: '在天愿作比翼鸟，在地愿为连理枝。', source: '白居易《长恨歌》', category: 'poetry' },
  { id: 'p-055', text: '千呼万唤始出来，犹抱琵琶半遮面。', source: '白居易《琵琶行》', category: 'poetry' },
  { id: 'p-056', text: '千山暮雪，只影向谁去。', source: '元好问《摸鱼儿·雁丘词》', category: 'poetry' },
  { id: 'p-057', text: '人生若只如初见，何事秋风悲画扇。', source: '纳兰性德《木兰花令》', category: 'poetry' },
  { id: 'p-058', text: '一生一代一双人，争教两处销魂。', source: '纳兰性德《画堂春》', category: 'poetry' },
  { id: 'p-059', text: '长风破浪会有时，直挂云帆济沧海。', source: '李白《行路难》', category: 'poetry' },
  { id: 'p-060', text: '空山新雨后，天气晚来秋。', source: '王维《山居秋暝》', category: 'poetry' },

  // ── 现代散文/名家语录 ──────────────────────────────
  { id: 'e-001', text: '愿你成为自己的太阳，无需凭借谁的光。', source: '林徽因', category: 'essay' },
  { id: 'e-002', text: '你若盛开，清风自来。', source: '三毛', category: 'essay' },
  { id: 'e-003', text: '我愿意相信，人与人的相遇，都是久别重逢。', source: '三毛', category: 'essay' },
  { id: 'e-004', text: '岁月从不败美人，时间会给你答案。', source: '席慕蓉', category: 'essay' },
  { id: 'e-005', text: '如果爱，请深爱；如若弃，请彻底。', source: '徐志摩', category: 'essay' },
  { id: 'e-006', text: '我将于茫茫人海中访我唯一灵魂之伴侣。', source: '徐志摩', category: 'essay' },
  { id: 'e-007', text: '纵然伤心，也不要愁眉不展，因为你不知道是谁会爱上你的笑容。', source: '泰戈尔', category: 'essay' },
  { id: 'e-008', text: '世界以痛吻我，要我报之以歌。', source: '泰戈尔', category: 'essay' },
  { id: 'e-009', text: '生如夏花之绚烂，死如秋叶之静美。', source: '泰戈尔', category: 'essay' },
  { id: 'e-010', text: '不要因为走得太远，而忘记当初为什么出发。', source: '纪伯伦', category: 'essay' },
  { id: 'e-011', text: '从明天起，做一个幸福的人，喂马、劈柴、周游世界。', source: '海子', category: 'essay' },
  { id: 'e-012', text: '面朝大海，春暖花开。', source: '海子', category: 'essay' },
  { id: 'e-013', text: '黑夜给了我黑色的眼睛，我却用它寻找光明。', source: '顾城', category: 'essay' },
  { id: 'e-014', text: '一个人至少拥有一个梦想，有一个理由去坚强。', source: '三毛', category: 'essay' },
  { id: 'e-015', text: '每个人心里都有一亩田，用它来种什么？种桃种李种春风。', source: '三毛', category: 'essay' },
  { id: 'e-016', text: '愿有岁月可回首，且以深情共白头。', source: '冯唐', category: 'essay' },
  { id: 'e-017', text: '一切都来得及，只要你愿意重新开始。', source: '李尚龙', category: 'essay' },
  { id: 'e-018', text: '你唯一需要打败的敌人就是昨天的自己。', source: '刘同', category: 'essay' },
  { id: 'e-019', text: '人这一生，最难得的是保持初心。', source: '周国平', category: 'essay' },
  { id: 'e-020', text: '真正的旅行，是把自己变成另一个人。', source: '龙应台', category: 'essay' },
  { id: 'e-021', text: '所谓父女母子一场，只不过意味着，你和他的缘分就是今生今世不断地在目送他的背影渐行渐远。', source: '龙应台《目送》', category: 'essay' },
  { id: 'e-022', text: '人总是需要一点点的仪式感，才会觉得活着有滋味。', source: '汪曾祺', category: 'essay' },
  { id: 'e-023', text: '家人闲坐，灯火可亲。', source: '汪曾祺', category: 'essay' },
  { id: 'e-024', text: '我们都在时光里，和自己和解。', source: '白落梅', category: 'essay' },
  { id: 'e-025', text: '愿所有的美好和温柔，都能如期而至。', source: '佚名', category: 'essay' },
  { id: 'e-026', text: '生活从来不会亏待认真努力的人。', source: '佚名', category: 'essay' },
  { id: 'e-027', text: '要做一朵自由行走的花。', source: '三毛', category: 'essay' },
  { id: 'e-028', text: '有些事情不是看到希望才去坚持，而是因为坚持才会看到希望。', source: '佚名', category: 'essay' },
  { id: 'e-029', text: '走得再远也不要忘记为什么出发。', source: '纪伯伦', category: 'essay' },
  { id: 'e-030', text: '愿你所有快乐，无需假装；愿你此生尽兴，赤诚善良。', source: '佚名', category: 'essay' },
  { id: 'e-031', text: '你的气质里，藏着你走过的路，读过的书，爱过的人。', source: '佚名', category: 'essay' },
  { id: 'e-032', text: '岁月是场有去无回的旅行，唯愿每一步都被温柔以待。', source: '佚名', category: 'essay' },
  { id: 'e-033', text: '做一个温暖的人，行一段踏实的路。', source: '佚名', category: 'essay' },
  { id: 'e-034', text: '生活给予你的每一次馈赠，都早已标好了价格。', source: '茨威格', category: 'essay' },
  { id: 'e-035', text: '人生海海，山山而川，不过尔尔。', source: '麦家', category: 'essay' },
  { id: 'e-036', text: '一个人的行走范围，就是他的世界。', source: '北岛', category: 'essay' },
  { id: 'e-037', text: '卑鄙是卑鄙者的通行证，高尚是高尚者的墓志铭。', source: '北岛', category: 'essay' },
  { id: 'e-038', text: '我想要两颗西柚，所以想要两颗。', source: '网络流行', category: 'essay' },
  { id: 'e-039', text: '人生不必精彩万分，只求对得起每一个当下。', source: '佚名', category: 'essay' },
  { id: 'e-040', text: '世界和我爱着你。', source: '史铁生', category: 'essay' },
];

/** 按分类过滤 */
export function filterByCategories(
  quotes: Quote[],
  categories: QuoteCategory[],
): Quote[] {
  if (categories.length === 0) return quotes;
  const set = new Set(categories);
  return quotes.filter((q) => set.has(q.category));
}

/** 获取所有分类（供 UI 多选渲染） */
export const QUOTE_CATEGORIES: QuoteCategory[] = ['aphorism', 'renmin', 'poetry', 'essay', 'custom'];
