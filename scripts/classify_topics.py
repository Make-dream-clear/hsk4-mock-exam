"""
Classify HSK4 vocabulary into topic categories based on the official
HSK 3.0 syllabus 话题大纲 (7 一级话题 → 31 二级话题 → 77 三级话题).

Strategy: DIRECT word→topic mapping only (no regex). Max 2 topics per word.
Outputs data/topics.json
"""
import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('data/vocabulary.json', 'r', encoding='utf-8') as f:
    vocab = json.load(f)

# ── Word→topic(s) mapping ────────────────────────────────────────────
# Each entry: 'word': 'topic_id' or 'word': ['topic1','topic2']
MAP = {
    # ═══ 个人情况 (Personal Info) ═══
    '鼻子':'personal', '皮肤':'personal', '胳膊':'personal', '脸':'personal',
    '性格':'personal', '脾气':'personal', '年龄':'personal', '身材':'personal',
    '帅':'personal', '美':'personal', '美丽':'personal', '活泼':'personal',
    '害羞':'personal', '诚实':'personal', '骄傲':'personal', '懒':'personal',
    '笨':'personal', '勇敢':'personal', '幽默':'personal', '自信':'personal',
    '耐心':'personal', '男士':'personal', '男性':'personal', '女性':'personal',
    '性别':'personal', '姑娘':'personal', '青年':'personal', '少年':'personal',
    '样子':'personal', '国籍':'personal', '老年':'personal', '中年':'personal',
    '身份证':['personal','daily-affairs'], '优秀':'personal', '温柔':'personal',
    '细心':'personal', '粗心':'personal',

    # ═══ 日常事务 (Daily Affairs) ═══
    '办理':'daily-affairs', '办事':'daily-affairs', '报名':'daily-affairs',
    '申请':'daily-affairs', '签证':'daily-affairs', '护照':'daily-affairs',
    '排队':'daily-affairs', '预约':'daily-affairs', '麻烦':'daily-affairs',
    '打扰':'daily-affairs', '寄':'daily-affairs', '填写':'daily-affairs',
    '证件':'daily-affairs', '证明':'daily-affairs', '手续':'daily-affairs',
    '挂号':'daily-affairs', '收费':'daily-affairs',

    # ═══ 交往 / 情感 (Social Interaction) ═══
    '礼貌':['social','etiquette'], '客气':['social','etiquette'],
    '感谢':'social', '道歉':'social', '表扬':'social', '批评':'social',
    '鼓励':'social', '原谅':'social', '误会':'social', '信任':'social',
    '尊重':['social','etiquette'], '友好':['social','exchange'],
    '友谊':'social', '友情':'social', '感动':'social', '感受':'social',
    '感觉':'social', '心情':'social', '感情':'social',
    '高兴':'social', '难过':'social', '伤心':'social', '生气':'social',
    '害怕':'social', '紧张':'social', '激动':'social', '兴奋':'social',
    '担心':'social', '着急':'social', '后悔':'social', '满意':'social',
    '失望':'social', '羡慕':'social', '孤独':'social', '幸福':'social',
    '愿望':'social', '梦想':'social', '抱歉':'social', '烦恼':'social',
    '得意':'social', '烦':'social', '讨厌':'social', '感人':'social',
    '不满':'social', '邀请':'social', '祝贺':'social', '干杯':'social',
    '笑话':'social', '浪漫':'social', '爱情':'social', '爱心':'social',
    '冷静':'social', '难受':'social', '无聊':'social', '可惜':'social',
    '庆祝':['social','customs'], '陪':'social', '愉快':'social',
    '内心':'social', '信心':'social',

    # ═══ 饮食 (Food & Drink) ═══
    '白酒':['food','food-culture'], '饼干':'food', '餐厅':'food',
    '茶叶':['food','food-culture'], '厨师':'food', '刀':'food',
    '果汁':'food', '苦':'food', '辣':'food', '咸':'food', '酸':'food',
    '甜':'food', '味':'food', '味道':'food', '香':'food', '鲜':'food',
    '饿':'food', '饱':'food', '盐':'food', '糖':'food', '油':'food',
    '醋':'food', '酱油':'food', '碗':'food', '筷子':'food', '勺子':'food',
    '盘子':'food', '食物':'food', '食品':'food', '菜单':'food',
    '服务员':'food', '快餐':'food', '晚餐':'food', '午餐':'food',
    '早餐':'food', '酸奶':'food', '馒头':'food', '美食':'food',
    '西红柿':'food', '葡萄':'food', '葡萄酒':'food', '汽水':'food',
    '聚餐':'food', '结账':['food','shopping'], '烤':'food', '汤':'food',
    '月饼':['food','food-culture','customs'], '饺子':['food','food-culture'],
    '小吃':['food','food-culture'], '零食':'food', '食堂':['food','campus'],
    '中餐':['food','food-culture'], '巧克力':'food', '熟':'food',

    # ═══ 交通出行 (Transport & Travel) ═══
    '车速':'transport', '车位':'transport', '乘客':'transport',
    '乘坐':'transport', '大巴':'transport', '飞机':'transport',
    '高铁':'transport', '火车':'transport', '机场':'transport',
    '交通':'transport', '出行':'transport', '出差':'transport',
    '出租车':'transport', '地铁':'transport', '公交':'transport',
    '司机':'transport', '行李':'transport', '停车':'transport',
    '停车场':'transport', '加油':'transport', '加油站':'transport',
    '导航':'transport', '堵车':'transport', '航班':'transport',
    '站':'transport', '票':'transport', '座位':'transport',
    '旅游':'transport', '旅行':'transport', '旅客':'transport',
    '旅馆':'transport', '景区':'transport', '景点':'transport',
    '酒店':'transport', '目的地':'transport', '电动车':'transport',
    '高速':'transport', '公路':'transport', '桥':'transport',
    '换乘':'transport', '转机1':'transport', '售票员':'transport',
    '降落':'transport', '登机':'transport', '背包':'transport',
    '路过':'transport', '街道':'transport', '导游':'transport',
    '道路':'transport', '地图':'transport', '入口':'transport',
    '入住':['transport','community'], '游玩':'transport',

    # ═══ 购物 (Shopping) ═══
    '打折':'shopping', '便宜':'shopping', '贵':'shopping',
    '价格':'shopping', '价钱':'shopping', '高价':'shopping', '低价':'shopping',
    '品牌':'shopping', '质量':'shopping', '超市':'shopping',
    '商场':'shopping', '商店':'shopping', '顾客':'shopping',
    '网购':'shopping', '广告':'shopping', '费':'shopping', '费用':'shopping',
    '现金':'shopping', '支付':['shopping','tech'], '购买':'shopping',
    '购物':'shopping', '货':'shopping', '商品':'shopping',
    '牌':'shopping', '牌子':'shopping', '零钱':'shopping',
    '零花钱':'shopping', '免费':'shopping', '赚':'shopping',
    '收费':'shopping', '存':'shopping',

    # ═══ 医疗健康 (Health & Medical) ═══
    '感冒':'health', '发烧':'health', '咳嗽':'health', '咳':'health',
    '头痛':'health', '肚子':'health', '疼':'health', '受伤':'health',
    '治疗':'health', '恢复':'health', '健康':'health',
    '锻炼':'health', '减肥':'health', '睡觉':'health', '休息':'health',
    '身体':'health', '营养':'health', '习惯':'health',
    '医院':'health', '医生':'health', '大夫':'health', '药':'health',
    '手术':'health', '检查':'health', '体检':'health', '护士':['health','career'],
    '打针':'health', '眼睛':'health', '心脏':'health', '血':'health',
    '体重':'health', '体温':'health', '全身':'health', '血压':'health',
    '卫生':'health', '躺':'health', '醒':'health', '困':'health',
    '牙齿':'health', '牙膏':'health', '眼镜':'health',

    # ═══ 休闲 (Leisure) ═══
    '电影':['leisure','arts'], '音乐':['leisure','arts'],
    '唱歌':'leisure', '跳舞':'leisure', '拍照':'leisure', '照片':'leisure',
    '爬山':'leisure', '散步':'leisure', '跑步':['leisure','sports'],
    '游泳':['leisure','sports'], '下棋':'leisure',
    '聚会':'leisure', '博物馆':'leisure', '展览':'leisure',
    '电视剧':'leisure', '电视':'leisure', '小说':['leisure','arts'],
    '故事':'leisure', '游戏':'leisure', '钓鱼':'leisure',
    '播放':'leisure', '节目':['leisure','arts'], '娱乐':'leisure',
    '参观':'leisure', '逛':'leisure', '有趣':'leisure',
    '约会':'leisure', '拍':'leisure', '图片':'leisure',
    '演出':['leisure','arts'], '演唱':['leisure','arts'],
    '歌声':['leisure','arts'], '歌手':['leisure','arts'],
    '弹':['leisure','arts'], '话剧':['leisure','arts'],
    '收听':'leisure', '广播':'leisure', '做梦':'leisure',

    # ═══ 社区 (Community & Housing) ═══
    '房子':'community', '楼':'community', '厨房':['community','food'],
    '卫生间':'community', '卧室':'community', '客厅':'community',
    '阳台':'community', '小区':'community', '邻居':'community',
    '物业':'community', '租':'community', '出租':'community',
    '搬':'community', '装修':'community', '家具':'community',
    '沙发':'community', '桌子':'community', '椅子':'community',
    '床':'community', '柜子':'community', '灯':'community',
    '空调':'community', '冰箱':'community', '洗衣机':'community',
    '电梯':'community', '楼梯':'community', '窗户':'community',
    '窗':'community', '门':'community', '钥匙':'community',
    '厕所':'community', '院子':'community', '房东':'community',
    '房租':'community', '修':'community', '修理':'community',
    '毛巾':'community', '纸巾':'community', '盒子':'community',
    '镜子':'community', '地址':'community', '帽子':'community',
    '袜子':'community', '外套':'community', '皮鞋':'community',
    '毛衣':'community', '袋子':'community', '桶':'community',
    '挂':'community',

    # ═══ 家庭生活 (Family Life) ═══
    '父母':'family', '父亲':'family', '母亲':'family', '父女':'family',
    '父子':'family', '母女':'family', '母子':'family',
    '哥哥':'family', '姐姐':'family', '弟弟':'family', '妹妹':'family',
    '儿子':'family', '女儿':'family', '孩子':'family', '儿童':'family',
    '丈夫':'family', '妻子':'family', '兄弟':'family',
    '爷爷':'family', '奶奶':'family', '叔叔':'family', '阿姨':'family',
    '亲戚':'family', '结婚':'family', '离婚':'family', '童年':'family',
    '家务':'family', '打扫':'family', '做饭':['family','food'],
    '照顾':'family', '长大':'family', '家庭':'family',
    '家乡':['family','overview'], '老家':['family','overview'],
    '家长':'family', '孙女':'family', '孙子':'family',
    '养成':'family', '小时候':'family',

    # ═══ 学习情况 (Study & Learning) ═══
    '考试':'study', '复习':'study', '预习':'study', '作业':'study',
    '成绩':'study', '毕业':'study', '知识':'study', '理解':'study',
    '背':'study', '练习':'study', '笔记':'study', '教材':'study',
    '词典':'study', '翻译':['study','language','career'],
    '语法':['study','language'], '发音':'study', '汉字':'study',
    '拼音':'study', '词汇':'study', '阅读':'study', '写作':'study',
    '听力':'study', '口语':['study','language'],
    '本科':'study', '笔试':'study', '报考':'study', '博士':'study',
    '硕士':'study', '专业':'study', '学期':'study', '分数':'study',
    '教育':['study','edu-issues'], '功课':'study', '学费':'study',
    '高考':'study', '课程':'study', '课堂':'study', '考生':'study',
    '入学':'study', '试题':'study', '自学':'study', '自习':'study',
    '作文':'study', '期末':'study', '期中':'study', '教学':'study',
    '说明':'study', '解释':'study', '学习':'study',

    # ═══ 校园生活 (Campus Life) ═══
    '大学':'campus', '学校':'campus', '同学':'campus', '老师':'campus',
    '教授':'campus', '教师':'campus', '图书馆':'campus', '操场':'campus',
    '宿舍':'campus', '奖学金':'campus', '社团':'campus', '班':'campus',
    '参赛':'campus', '大赛':'campus', '比赛':['campus','sports'],
    '竞争':'campus', '师生':'campus', '院长':'campus', '学院':'campus',
    '活动':'campus',

    # ═══ 教育问题 (Education Issues) ═══
    '培训':'edu-issues', '压力':'edu-issues', '能力':'edu-issues',
    '兴趣':'edu-issues', '爱好':'edu-issues', '目标':'edu-issues',
    '计划':'edu-issues', '选择':'edu-issues', '理想':'edu-issues',

    # ═══ 日常办公 (Office & Work) ═══
    '办公':'office', '上班':'office', '加班':'office', '开会':'office',
    '会议':'office', '报告':'office', '任务':'office', '项目':'office',
    '安排':'office', '通知':'office', '邮件':'office', '文件':'office',
    '材料':'office', '打印':'office', '打印机':'office', '合同':'office',
    '效率':'office', '完成':'office', '负责':'office', '工作':'office',
    '复印':'office', '时间表':'office', '资料':'office',

    # ═══ 职场交往 (Workplace Relations) ═══
    '同事':'workplace-social', '领导':'workplace-social',
    '老板':'workplace-social', '客户':'workplace-social',
    '合作':['workplace-social','exchange'], '团队':'workplace-social',
    '沟通':'workplace-social', '交流':['workplace-social','exchange'],
    '讨论':'workplace-social', '建议':'workplace-social',
    '反对':'workplace-social', '支持':'workplace-social',
    '同意':'workplace-social', '拒绝':'workplace-social',
    '意见':'workplace-social', '队员':'workplace-social',
    '队长':'workplace-social', '商量':'workplace-social',

    # ═══ 职业与经历 (Career & Experience) ═══
    '职业':'career', '律师':'career', '记者':'career', '警察':'career',
    '演员':['career','arts'], '作家':['career','arts'],
    '导演':['career','arts'], '歌手':['career','arts'],
    '经理':'career', '招聘':'career', '面试':'career',
    '简历':'career', '经验':'career', '经历':'career', '实习':'career',
    '打工':'career', '交警':'career', '工人':'career', '师傅':'career',
    '应聘':'career', '作者':['career','arts'], '读者':'career',
    '人员':'career', '干活儿':'career',

    # ═══ 单位情况 (Company & Organization) ═══
    '公司':'company', '工厂':'company', '单位':'company', '部门':'company',
    '管理':'company', '工资':'company', '奖金':'company', '保险':'company',
    '请假':'company', '辞职':'company', '退休':'company', '制度':'company',
    '规定':'company', '福利':'company', '行业':'company', '收入':'company',
    '责任':'company',

    # ═══ 自然 (Nature) ═══
    '山':'nature', '河':'nature', '湖':'nature', '海':'nature',
    '森林':'nature', '树林':'nature', '海洋':'nature', '江':'nature',
    '花':'nature', '树':'nature', '叶子':'nature', '草地':'nature',
    '太阳':'nature', '月亮':'nature', '星星':'nature', '云':'nature',
    '风':'nature', '雨':'nature', '雪':'nature', '冰':'nature',
    '温度':'nature', '气候':'nature', '气温':'nature', '天气':'nature',
    '大自然':'nature', '景色':'nature', '风景':'nature', '美景':'nature',
    '植物':'nature', '动物':'nature', '猫':'nature', '狗':'nature',
    '鸟':'nature', '鱼':'nature', '老虎':'nature', '熊猫':'nature',
    '熊':'nature', '岛':'nature', '暖和':'nature', '凉':'nature',
    '低温':'nature', '高温':'nature', '降温':'nature',
    '阳光':'nature', '寒冷':'nature', '自然':'nature',
    '土':'nature',

    # ═══ 环境 (Environment) ═══
    '环保':'environment', '污染':'environment', '垃圾':'environment',
    '保护':'environment', '资源':'environment', '节约':'environment',
    '空气':'environment', '环境':'environment', '塑料':'environment',
    '浪费':'environment',

    # ═══ 科技发展 (Technology) ═══
    '电脑':'tech', '手机':'tech', '互联网':'tech', '网络':'tech',
    '数据':'tech', '信息':'tech', '科技':['tech','science'],
    '视频':'tech', '密码':'tech', '扫码':'tech', '数字':'tech',
    '网友':'tech', '短信':'tech', '网页':'tech', '网址':'tech',
    '线上':'tech', '线下':'tech', '信号':'tech', '转发':'tech',
    '充电':'tech', '下载':'tech', '程序':'tech', '系统':'tech',
    '平台':'tech', '账号':'tech', '网站':'tech',

    # ═══ 科学知识 (Science) ═══
    '地球':'science', '技术':'science', '研究':'science',
    '科学':'science', '发现':'science', '发明':'science',
    '太空':'science', '实验':'science',

    # ═══ 概况 (Overview) ═══
    '城市':'overview', '城':'overview', '农村':'overview', '村':'overview',
    '省1':'overview', '区':'overview', '市区':'overview', '首都':'overview',
    '民族':'overview', '郊区':'overview', '地区':'overview',
    '东部':'overview', '南部':'overview', '西部':'overview', '北部':'overview',
    '各地':'overview', '少数':'overview', '人口':'overview',

    # ═══ 经济现象 (Economy) ═══
    '经济':'economy', '市场':'economy', '出口':'economy',
    '生意':'economy', '快递':['economy','tech'],
    '外卖':'economy', '消费':'economy',

    # ═══ 社会现象 (Social Phenomena) ═══
    '社会':'social-phenomena', '法律':'social-phenomena',
    '法':'social-phenomena', '安全':'social-phenomena',
    '安检':'social-phenomena', '新闻':'social-phenomena',
    '消息':'social-phenomena', '杂志':'social-phenomena',
    '态度':'social-phenomena', '流行':'social-phenomena',
    '改变':'social-phenomena', '公共':'social-phenomena',
    '危险':'social-phenomena', '观众':'social-phenomena',
    '火':'social-phenomena',

    # ═══ 文艺 (Arts & Literature) ═══
    '艺术':'arts', '话剧':'arts', '剧院':'arts',
    '京剧':['arts','customs'], '作品':'arts', '钢琴':'arts',
    '琴':'arts', '舞台':'arts', '创作':'arts',
    '文化':'arts', '小说':['arts','leisure'], '观众':'arts',
    '听众':'arts',

    # ═══ 体育 (Sports) ═══
    '体育':'sports', '运动':['sports','health'], '足球':'sports',
    '篮球':'sports', '乒乓球':'sports', '羽毛球':'sports', '排球':'sports',
    '教练':'sports', '训练':'sports', '健身':'sports', '健身房':'sports',
    '功夫':['sports','customs'], '武术':'sports', '太极':'sports',
    '球队':'sports', '球迷':'sports', '赢':'sports', '赢得':'sports',
    '输':'sports', '打败':'sports', '冠军':'sports',

    # ═══ 中外交流 (International Exchange) ═══
    '国际':'exchange', '全球':'exchange', '亚洲':'exchange',
    '使馆':'exchange', '世界':'exchange', '留学':'exchange',

    # ═══ 语言文字 (Language & Writing) ═══
    '普通话':'language', '文字':'language', '文章':'language',
    '词语':'language', '说法':'language', '表示':'language',
    '语言':'language', '成语':'language',

    # ═══ 饮食文化 (Food Culture) ═══
    # (mostly handled via multi-topic entries above)

    # ═══ 民俗传统 (Folk Customs & Traditions) ═══
    '传统':'customs', '红包':'customs', '节日':'customs',
    '春节':'customs', '过年':'customs', '古典':'customs',
    '书法':'customs',

    # ═══ 人际交往礼仪 (Social Etiquette) ═══
    '礼物':'etiquette', '请客':'etiquette', '做客':'etiquette',
    '面子':'etiquette', '谦虚':'etiquette', '关系':'etiquette',
    '称呼':'etiquette',

    # ═══ 人文景观 & 历史 (Landmarks & History) ═══
    '著名':'landmarks', '历史':'landmarks', '景点':['landmarks','transport'],
    '景区':['landmarks','transport'], '古代':'landmarks',
    '世纪':'landmarks',

    # ═══ Cross-topic ═══
    '寒假':'study', '暑假':'study', '假日':'customs',
    '节假日':'customs', '度假':'leisure',

    # ═══ Additional (wave 2) ═══
    '动车':'transport', '乘1':'transport', '厂':'company', '工厂':'company',
    '鲜花':'nature', '日记':'study', '烟':'health', '汗':'health',
    '力气':'health', '调查':'office', '会员':'shopping',
    '降价':['shopping','economy'], '动作':'sports', '大厅':'community',
    '理发':'personal', '戴':'personal', '生1':'family', '点名':'campus',
    '种':'nature', '着火':'social-phenomena', '观看':'leisure',
    '外出':'transport', '乘':'transport', '付':'shopping',
    '发送':'tech', '回复':'tech', '订':'shopping',
    '早晨':'family', '夜晚':'nature', '日常':'family',
    '美好':'social', '抱':'social', '热闹':'customs',
    '放松':'leisure', '精彩':'arts', '光':'nature',
    '鲜':'food', '馒头':'food', '葡萄':'food',
    '相声':'arts', '日出':'nature', '晚安':'social',
    '人生':'social', '生命':'social', '梦':'social',
    '环境':'environment', '资源':'environment',
    '保险':'company', '行业':'company',
    '选择':'edu-issues', '兴趣':'edu-issues',
    '漫画':'leisure', '儿童':'family',
    '适应':'study', '发音':'study',
    '表现':'office', '老师':'campus',
    '同学':'campus', '省1':'overview',
    '增长':'economy', '消费':'economy',
}

# ── Topic hierarchy ───────────────────────────────────────────────────
TOPICS = [
    {"id":"personal","p":"日常生活","p_en":"Daily Life","name":"个人情况","name_en":"Personal Info",
     "sub":["个人信息","个人特征"]},
    {"id":"daily-affairs","p":"日常生活","p_en":"Daily Life","name":"日常事务","name_en":"Daily Affairs",
     "sub":["业务办理","困难求助"]},
    {"id":"social","p":"日常生活","p_en":"Daily Life","name":"交往","name_en":"Social Interaction",
     "sub":["礼貌行为","情感","感悟"]},
    {"id":"food","p":"日常生活","p_en":"Daily Life","name":"饮食","name_en":"Food & Drink",
     "sub":["食物饮品","就餐","做菜"]},
    {"id":"transport","p":"日常生活","p_en":"Daily Life","name":"交通出行","name_en":"Transport & Travel",
     "sub":["出行经历","交通"]},
    {"id":"shopping","p":"日常生活","p_en":"Daily Life","name":"购物","name_en":"Shopping",
     "sub":["商品选购","购物体验","商家活动"]},
    {"id":"health","p":"日常生活","p_en":"Daily Life","name":"医疗健康","name_en":"Health & Medical",
     "sub":["就医","健康生活"]},
    {"id":"leisure","p":"日常生活","p_en":"Daily Life","name":"休闲","name_en":"Leisure",
     "sub":["休闲活动","活动感受、看法等"]},
    {"id":"community","p":"日常生活","p_en":"Daily Life","name":"社区","name_en":"Community & Housing",
     "sub":["居住情况","社区生活","房屋租赁与买卖"]},
    {"id":"family","p":"日常生活","p_en":"Daily Life","name":"家庭生活","name_en":"Family Life",
     "sub":["居家生活","家庭关系","成长过程","生活习惯","家庭事务"]},
    {"id":"study","p":"教育情况","p_en":"Education","name":"学习情况","name_en":"Study & Learning",
     "sub":["课程情况","教学情况","学习经历","学习心得"]},
    {"id":"campus","p":"教育情况","p_en":"Education","name":"校园生活","name_en":"Campus Life",
     "sub":["校园活动","学校情况"]},
    {"id":"edu-issues","p":"教育情况","p_en":"Education","name":"教育问题","name_en":"Education Issues",
     "sub":["家庭教育","社会教育"]},
    {"id":"office","p":"职场生活","p_en":"Work Life","name":"日常办公","name_en":"Office & Work",
     "sub":["办公事务","工作表现"]},
    {"id":"workplace-social","p":"职场生活","p_en":"Work Life","name":"职场交往","name_en":"Workplace Relations",
     "sub":[]},
    {"id":"career","p":"职场生活","p_en":"Work Life","name":"职业与经历","name_en":"Career & Experience",
     "sub":["工作经历","职业现状、职业评价"]},
    {"id":"company","p":"职场生活","p_en":"Work Life","name":"单位情况","name_en":"Company & Organization",
     "sub":["人事管理","工作环境与待遇"]},
    {"id":"nature","p":"自然与环境","p_en":"Nature & Environment","name":"自然","name_en":"Nature",
     "sub":["地理","气候","动植物","自然景观","自然现象"]},
    {"id":"environment","p":"自然与环境","p_en":"Nature & Environment","name":"环境","name_en":"Environment",
     "sub":["环境状况","环境保护"]},
    {"id":"tech","p":"科学技术","p_en":"Science & Technology","name":"科技发展","name_en":"Technology",
     "sub":["新技术运用"]},
    {"id":"science","p":"科学技术","p_en":"Science & Technology","name":"科学知识","name_en":"Science",
     "sub":["科普知识","科研成果"]},
    {"id":"overview","p":"当代社会","p_en":"Contemporary Society","name":"概况","name_en":"Overview",
     "sub":["首都、主要省市","少数民族"]},
    {"id":"economy","p":"当代社会","p_en":"Contemporary Society","name":"经济现象","name_en":"Economy",
     "sub":["流行产品","新商业形态","经济状况"]},
    {"id":"social-phenomena","p":"当代社会","p_en":"Contemporary Society","name":"社会现象","name_en":"Social Phenomena",
     "sub":["生活观念","网络生活","基础设施","流行事物"]},
    {"id":"arts","p":"当代社会","p_en":"Contemporary Society","name":"文艺","name_en":"Arts & Literature",
     "sub":["文艺形式","文艺活动","创作者及其作品"]},
    {"id":"sports","p":"当代社会","p_en":"Contemporary Society","name":"体育","name_en":"Sports",
     "sub":["运动项目","体育比赛","体育名人、体育故事"]},
    {"id":"exchange","p":"当代社会","p_en":"Contemporary Society","name":"中外交流","name_en":"International Exchange",
     "sub":["友好往来"]},
    {"id":"language","p":"文化与传统","p_en":"Culture & Traditions","name":"语言文字","name_en":"Language & Writing",
     "sub":["俗语、名言等"]},
    {"id":"food-culture","p":"文化与传统","p_en":"Culture & Traditions","name":"饮食文化","name_en":"Food Culture",
     "sub":["传统饮食观念","各地饮食、传统店铺、品牌等"]},
    {"id":"customs","p":"文化与传统","p_en":"Culture & Traditions","name":"民俗传统","name_en":"Folk Customs & Traditions",
     "sub":["传统节日与习俗","国粹","各地传统"]},
    {"id":"etiquette","p":"文化与传统","p_en":"Culture & Traditions","name":"人际交往礼仪","name_en":"Social Etiquette",
     "sub":[]},
    {"id":"landmarks","p":"文化与传统","p_en":"Culture & Traditions","name":"人文景观","name_en":"Landmarks & History",
     "sub":["名胜古迹等","历史人物、历史事件"]},
]

# ── Classify ──────────────────────────────────────────────────────────
topic_words = {t['id']: [] for t in TOPICS}
word_topics = {}

for w in vocab:
    wid = w['id']
    word = w['word']
    if word not in MAP:
        continue

    val = MAP[word]
    if isinstance(val, str):
        assigned = [val]
    else:
        assigned = val[:2]  # max 2 topics

    word_topics[wid] = assigned
    for tid in assigned:
        if tid in topic_words:
            topic_words[tid].append(wid)

# ── Build output ──────────────────────────────────────────────────────
parents_order = ["日常生活","教育情况","职场生活","自然与环境","科学技术","当代社会","文化与传统"]
parents_en = {"日常生活":"Daily Life","教育情况":"Education","职场生活":"Work Life",
              "自然与环境":"Nature & Environment","科学技术":"Science & Technology",
              "当代社会":"Contemporary Society","文化与传统":"Culture & Traditions"}

output = {"hierarchy": [], "topic_words": topic_words,
          "word_topics": {str(k): v for k, v in word_topics.items()}, "stats": {}}

for p in parents_order:
    group = {"name": p, "name_en": parents_en[p], "topics": []}
    for t in TOPICS:
        if t['p'] == p:
            group["topics"].append({
                "id": t['id'], "name": t['name'], "name_en": t['name_en'],
                "sub_topics": t['sub'],
                "word_count": len(topic_words[t['id']])
            })
    output["hierarchy"].append(group)

classified = len(word_topics)
output["stats"] = {
    "total_words": len(vocab),
    "classified": classified,
    "unclassified": len(vocab) - classified,
    "coverage_pct": round(classified / len(vocab) * 100, 1)
}

with open('data/topics.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

# ── Report ────────────────────────────────────────────────────────────
vmap = {w['id']: w for w in vocab}
print(f"Total: {len(vocab)}, Classified: {classified} ({output['stats']['coverage_pct']}%), Unclassified: {output['stats']['unclassified']}")
print()

for group in output["hierarchy"]:
    total = sum(t["word_count"] for t in group["topics"])
    print(f"\n{group['name']} ({group['name_en']}) — {total}")
    for t in group["topics"]:
        ids = topic_words[t['id']]
        words = [vmap[i]['word'] for i in ids[:12] if i in vmap]
        print(f"  {t['name']} ({t['word_count']}): {'、'.join(words)}")

# Verify no wrong topic IDs
valid_ids = {t['id'] for t in TOPICS}
for word, val in MAP.items():
    topics = [val] if isinstance(val, str) else val
    for tid in topics:
        if tid not in valid_ids:
            print(f"WARNING: Invalid topic ID '{tid}' for word '{word}'")
