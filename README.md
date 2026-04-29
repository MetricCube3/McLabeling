# McLabeling图像标注平台

- [简介](#简介)
- [主要功能](#主要功能)
- [部署](#部署)
- [使用文档](#使用文档)
- [Changelog](#changelog)

  

## 简介

该系统是一个适合小团队协作的图像标注平台，支持视频和图片的实例分割标注、目标检测标注，集成YOLO模型训练和自动标注功能，适用于计算机视觉项目的数据标注和模型训练工作流。

> **💡 在线平台推荐**
> 
> 如果不想本地部署，欢迎直接使用我们免费的**在线标注训练平台**：
> 
> 🌐 **[https://smartannotax.top/](https://smartannotax.top/)**
> 
> 在线平台提供更多功能特性，欢迎尝试！



## 主要功能

### 核心功能
- **多项目管理**：支持创建多个标注项目，每个项目独立管理标签和任务
- **视频/图片标注**：支持实例分割和边界框标注
- **任务分配**：管理员可将标注任务分配给不同标注员
- **审核流程**：支持标注结果的审核和修改
- **数据导出**：同步导出分割和检测标注结果，支持YOLO格式和COCO格式

### 标注和训练
- **SAM辅助标注**：基于SAM模型的智能辅助标注
- **手动标框**：支持拖拽绘制矩形框，适合目标检测任务
- **手动多边形**：支持点击顶点绘制任意多边形，适合复杂形状标注
- **模型训练**：选择项目标注数据，在平台内直接训练YOLO模型
- **自动标注**：使用训练好的YOLO模型进行自动标注

### 用户管理
- **角色权限**：支持管理员、标注员、审核员等多角色
- **任务统计**：实时查看标注进度和统计信息



## 部署

本平台采用轻量化设计，特别适合快速部署和小团队使用：

- 前端使用原生js + HTML，只需安装后端Python依赖即可运行

- 使用SQLite本地数据库

- 推荐在带有gpu的服务器或wsl中部署

### Docker部署（推荐）

1. 安装docker，docker compose
2. **拉取镜像**
```bash
sudo docker pull registry.cn-hangzhou.aliyuncs.com/metriccube3/mclabeling:latest
sudo docker tag xxxxx mclabeling:latest
```

3. **使用部署脚本**

```bash
git clone https://github.com/MetricCube3/McLabeling.git

cd McLabeling

# 下载san2.1_l到McLabeling目录下

chmod +x deploy.sh

sudo bash deploy.sh
```

### 快速开始

1. **克隆项目**
```bash
git clone https://github.com/MetricCube3/McLabeling.git

cd McLabeling

# 下载san2.1_l到McLabeling目录下
```

2. **安装依赖**

```bash
pip install -r requirements.txt
```

3. **启动服务**

```bash
python main.py
```

### 登录

访问 `http://ip:3000`，使用默认管理员账号登录。

- 用户名：`admin`

- 密码：`admin`

  

## 使用文档

详细的使用说明请查看：[使用文档](doc/user_guide.md)

包含以下内容：
- 项目管理
- 标注任务创建与分配
- 标注工具使用说明
- 数据导出
- 模型训练与自动标注



## Changelog

- `2026-04-29`: 增加手动标注功能，包括矩形框和多边形标注
- `2026-04-27`: 前端代码模块化改造，优化标注界面功能
- `2026-04-16`: 发布首个版本，完成多项目管理系统、视频/图片实例分割和目标检测标注、SAM辅助标注、YOLO模型训练集成、Docker快速部署支持
- 更多信息，请查看 [CHANGELOG](doc/changelog.md)


