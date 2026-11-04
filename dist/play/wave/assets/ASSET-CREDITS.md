# 视觉素材记录

## basalt-v1.png

保存路径：`C:/Users/chenhua/Desktop/midi.cn/game-wave/dist/assets/basalt-v1.png`

用途：三维海岛与峡谷岩壁的颜色和凹凸材质。使用内置 ImageGen 工具生成，原图已复制到项目内；不依赖外部图片地址。

生成提示词：

> Use case: stylized-concept. Asset type: high-end 3D sci-fi flight game terrain albedo texture. Create ONE seamless tileable square photoreal dark weathered volcanic basalt surface texture, orthographic top-down, flat even diffuse studio light, no directional shadows, no horizon, no objects, no lettering, no text, no watermark. Fine fissures and realistic mineral grain with subtle cool slate blue and neutral graphite variations, dry matte rock, medium detail at large scale and sharp fine surface microdetail. Full-bleed texture all the way to the four edges, seamless repetition horizontally and vertically. Texture should look like a physically based albedo photograph, not a relief sculpture or a landscape. This image will be mapped onto sculpted coastal rock cliffs in a 3D game.

其余机体涂层、反射环境、海面、地形、天空、爆炸和界面均由代码生成。

## 音乐第二版

`neon-resonance.wav`：60 秒、128 BPM、44.1 kHz 双声道原创合成配乐。`combat-pulse.wav`：与主配乐等长、同拍点的单声道战斗打击乐分轨。均由 `scripts/compose-soundtrack.py` 使用 NumPy 从振荡器与噪声合成，无外部采样。

配器：底鼓、军鼓与拍手、闭合和开放踩镲、低音合成器、和弦铺底、铃音琶音、双声部主旋律、立体声延迟、过门与上升效果。四段编排分别对应 0、15、30、45 秒场景。

城市灯窗、行星条纹、交通支架、雾光与频谱灯带均由项目代码生成。
