# 靡靡之音 · game-portal

三款音乐游戏的沉浸式 3D 展厅：吞噬交响曲、回响原野、音浪穿梭。保留浩瀚星海和蓝紫星云，分别展示发光生命体、森林浮岛与星际飞船。

## 运行

- npm start：本地预览 http://127.0.0.1:4190/
- npm run check：检查首页、模型、世界资料和同步脚本语法。
- npm test：验证三款游戏入口、截图与模块资源完整性。
- npm run sync:games：从同级 game-devour、game-echo、game-wave 同步当前游戏快照与真实截图。

## 体验

点击底部三个游戏卡片、前后按钮、键盘左右方向键或在手机场景上左右滑动来切换。场景会通过星光拉伸、音波扩散、镜头推进和模型旋转完成跃迁，文案与游戏入口同步变化。连续操作保留最后一次选择。开启声音后，原创环境音乐随当前世界更换调式，并使用真实频谱驱动三维场景。尊重减少动态效果偏好，WebGL 不可用时仍能切换介绍与进入游戏。

## 结构

- dist/index.html、style.css：展厅结构、排版、游戏卡片及转场视觉。
- dist/main.js：切换队列、键盘/触控、声音、玩法说明与全屏。
- dist/worlds.js：三款游戏资料、展示配色、音乐和入口。
- dist/scene.js：宇宙背景、生命体、粒子跃迁与镜头。
- dist/world-models.js：森林浮岛、共鸣音塔、飞船与星际航道。
- dist/assets/：三款游戏的真实截图。
- dist/vendor/：首页自己的 Three.js 与 MIT 授权，不依赖旧游戏副本。
- dist/play/devour、echo、wave：从三个独立项目同步的当前可玩快照。
- scripts/sync-games.mjs：快照与截图同步工具。

三个游戏各自在同级独立项目维护，正式首页入口使用 devour.midi.cn、echo.midi.cn、wave.midi.cn 三个独立分站；localhost 与 127.0.0.1 预览使用 play/ 下的同步快照。三个源项目独立维护，部署使用各仓库的 gh-pages 分支，Cloudflare 与 DNS 设置不由首页脚本修改。

仅点击后开启声音；可选 Google Fonts 加载失败时回退系统字体。所有模型、星云和声音实时生成，无新图片生成依赖。已有 symphony/、pulse/ 历史文件暂留，但新展厅不依赖它们。
