# 一、整体技术路线（端到端流水线）

1. **人体解析与前处理**

- 人体分割：RTMDet/Seg 或 MODNet（抠人、去背景）
- 关键点检测：RTMPose / OpenPose（稳定姿态先验）
- 人脸/发丝保护：可选，用于更真实合成

1. **单张图三维人体恢复（Body Mesh Recovery）**

- **SMPL-X** 拟合（优先 PARE 或 SPIN，必要时 PIXIE 做面部/手部更细化）
- 输出：`{vertices(Nx3), faces, pose θ, shape β, camera}`

1. **服装资产获取与归一化**

- 来自电商图（正面衣平铺）或 3D 服装模板（T恤/衬衫/外套/裙装）
- 纹理到 **服装 UV**；类别模板 + 尺码参数化（S/M/L → 尺寸标量）

1. **服装映射与穿戴（Garment Retargeting & Draping）**

- 几何对齐：将服装模板绑定到 SMPL-X T-pose
- 形变策略（先简后难）
  - MVP：**线性蒙皮 + 非刚性 ICP** → 能穿上就行
  - 进阶：**CAPE/SMPLicit 风格的形变回归**，或小型 GNN/MLP 学习皱褶校正

1. **纹理与真实感增强（Rendering & Neural Dressing）**

- MVP：PyTorch3D / Three.js 标准 PBR 渲染 + 法线/粗糙度近似
- 进阶：**Conditional GAN / Diffusion** 做“外观精修”（缝线、阴影、皱褶高光）
  - 条件：输入（原人像裁剪、渲染初稿、人体解析图、深度/法线图）

1. **前端可视化**

- 浏览器 Three.js：展示可交互的 **GLB/DRACO** 模型，切换不同服装与颜色/材质
- 选装 AR 试穿（WebXR，后续再做）

1. **服务化**

- FastAPI：上传图片 → 异步任务队列（Celery/Redis）→ 结果轮询/回调
- 队列与缓存：MinIO/S3 存储中间结果与 GLB

------

# 二、分阶段落地（4 个里程碑）

**M0（1–2 周，MVP 可跑）**

- PARE/SMPL-X 单人图三维重建，Three.js 里渲染人体裸模
- 服装平铺图贴到**简化 T 恤模板**（固定类目）
- FastAPI 接入：`/tryon` 单接口、前端页面上传与预览

**M1（+2–3 周，可演示）**

- 服装几何自动对齐与简易“披挂”（蒙皮 + ICP）
- 条纹/Logo 纹理保真度优化（UV 展开与抗拉伸校正）
- 体型自适配（β→胸围/肩宽/腰围参数化）
- 前端：衣服尺码/颜色切换、旋转缩放、环境光/方向光

**M2（+3–4 周，体验提升）**

- 条件生成模型**Refine** 渲染：小型 **Cond-GAN** 或 **轻量扩散模型**
- 阴影/接触皱褶合成 & 领口/袖口边界自然过渡
- 多类目支持（T 恤/外套/长裙/下装），更强的遮挡处理（袖子、长发）

**M3（+3–4 周，论文级/产品级）**

- 学习型布料形变（参考 **CAPE** 思路）或轻量 **Neural Cloth**（GNN/MLP）
- 光照一致性（估计环境光 + 重新着色）、材质分解（漫反射/高光）
- 简单体姿动画预览（驱动 SMPL-X 骨架，服装随动）

------

# 三、模型/数据集与训练建议

**人体网格恢复**

- 模型：**PARE / SPIN / PIXIE**（SMPL-X）
- 训练/微调数据：3DPW、Human3.6M、AGORA、EHF（评测）
- 关键技巧：弱监督（2D 关键点 + 分割）+ 形状先验

**服装纹理 & Try-On**

- 图像到人像：DeepFashion、VITON/VITON-HD、DressCode（上衣/下装分类好）
- 几何：**CAPE**（服装形变到体形/姿态的校正先验）
- 生成模型（Refine）：小 U-Net 条件扩散 或 pix2pixHD 风格的 Cond-GAN
- 评价：**LPIPS / FID**（外观），**Silhouette IoU / SSIM**（轮廓/结构）

**三维/渲染**

- 引擎：PyTorch3D（离线/训练阶段）+ **Three.js（在线展示）**
- 资产：基础 SMPL-X 网格、服装模板（自建或开源简模），支持 GLTF/GLB

------

# 四、系统架构草图

**前端（Next.js + Three.js）**

- 上传组件（图片/隐私提示）
- 模型查看器（加载 GLB、HDR 环境贴图、UI 切换服装）
- 结果缓存与分享（生成短链）

**后端（FastAPI）**

- `/tryon`：POST 上传图 + 服装 ID → 任务 ID
- `/result/{id}`：GET 任务状态与结果（GLB/图像 URL）
- Worker（Celery）：`segment → keypoints → SMPL-X → garment fit → render → refine`

**存储/队列**

- 对象存储：MinIO/S3（输入图、UV、GLB、成品图）
- 队列：Redis/RabbitMQ
- 日志/监控：Prometheus + Grafana（可后置）

------

# 五、核心难点与可执行解法

1. **单张图的体型/姿态稳定**

- 多先验融合：关键点 + 分割 + 人体轮廓；对低质图做 Test-Time Aug
- 形状 β 正则 & 身材分类先验（small/regular/large）提升鲁棒

1. **服装几何与人体贴合/穿模**

- 分区蒙皮（躯干/袖口/下摆不同权重）
- 领口/袖口用距离场裁切（SDF），减少穿插
- 进阶用 **Laplace/ARAP** 能量约束做形变优化（10–30 iter）

1. **纹理拉伸与皱褶**

- UV 空间拉伸惩罚（Jacobian 正则）
- 生成模型仅做 **残差增强层**（shadow/crease/specular），避免改动大结构

1. **遮挡（头发/手臂/饰品）**

- 人体解析成多部位层（face/hair/upper/lower/arms）→ 分层合成
- 透明发丝边缘用软蒙版 + Guided Filter

------

# 六、评测与 A/B 指标

- **几何**：PCK@0.1（关键点），Chamfer/Normal Consistency（与 GT 网格，若有）
- **外观**：LPIPS、SSIM、FID（与参考/基线）
- **可用性**：用户主观评分（逼真度/合身度/细节 1–5）
- **性能**：端到端延迟（目标：M1 ≤ 6–10s/1080p，M3 ≤ 3–5s，依赖 GPU）

------

# 七、仓库结构建议

```
virtual-tryon-3d/
├─ backend/
│  ├─ api/                  # FastAPI 路由
│  ├─ workers/              # Celery 任务
│  ├─ models/               # PARE/SPIN/PIXIE、Refine-GAN/Diffusion
│  ├─ garment/              # 模板、绑定、ICP/ARAP 对齐
│  └─ render/               # PyTorch3D & glTF 导出
├─ frontend/
│  ├─ app/                  # Next.js pages
│  ├─ components/           # Three.js 视图器、上传、UI
│  └─ public/               # 演示资产、HDR
├─ assets/                  # SMPL-X, 服装模板、UV
├─ scripts/                 # 训练/数据处理/评测脚本
├─ docs/                    # 架构图、路线图、演示 GIF
└─ docker/                  # 一键启动（api/worker/frontend）
```

------

# 八、API 合同（FastAPI 示例）

- `POST /tryon`
  - body: `{ image: File, garment_id: str, size: str, refine: bool }`
  - resp: `{ task_id: str }`
- `GET /result/{task_id}`
  - resp: `{ status: ["queued","running","done","failed"], preview_url, glb_url, metrics:{} }`
- `GET /garments`
  - resp: `[{ id, category, sizes, colorways, material }]`

------

# 九、隐私与合规

- 所有图像仅做临时处理（N 分钟自动清理），支持“本地完全离线模式”
- 面部匿名化选项（模糊/替换），用户可一键删除数据
- 只开放**研究许可**的模型/权重下载条款

------

# 十、可选增强（锦上添花）

- **体姿动画**：几组预设 pose（走/坐/挥手），服装随动
- **材质编辑**：法线/粗糙/金属度 sliders，近似不同面料
- **多摄像头重建**：双视角时精度飙升（写在未来计划）