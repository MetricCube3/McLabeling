<div align="center">

# McLabeling

**轻量级图像标注平台 | 实例分割 · 目标检测 · 模型训练**

[![GitHub](https://img.shields.io/badge/GitHub-McLabeling-blue?logo=github)](https://github.com/MetricCube3/McLabeling)
[![Python](https://img.shields.io/badge/Python-3.8+-blue?logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux%20|%20WSL%20|%20Docker-lightgrey)]()

[功能特性](#功能特性) · [快速开始](#快速开始) · [使用文档](#使用文档) · [更新日志](#更新日志)

</div>

---

McLabeling 是一个面向小团队的图像标注平台，支持视频和图片的实例分割、目标检测标注，集成 SAM 辅助标注、YOLO 模型训练和自动标注功能。前端原生 JS + HTML，后端 Python + SQLite，开箱即用。

> 💡 不想本地部署？欢迎使用免费的 **[在线标注训练平台 smartannotax.top](https://smartannotax.top/)**

## 功能特性

### 🎯 标注工具

| 模式 | 说明 |
|:---|:---|
| **SAM 辅助标注** | 基于 SAM 模型，左键正点 / 右键负点，快速获取精确轮廓 |
| **矩形框** | 鼠标拖拽绘制，适合目标检测任务 |
| **多边形** | 逐点绘制任意多边形，适合复杂形状 |
| **OBB 旋转框** | 三点法绘制旋转矩形，适合倾斜物体（航拍车辆、建筑等） |
| **标注编辑** | 对已有标注进行顶点拖拽、插入 / 删除顶点、整体平移等精修操作 |

### 🚀 训练与自动标注

- 在平台内选择项目数据直接训练 YOLO 模型
- 使用训练好的模型一键自动标注，自动匹配项目标签

### 📦 数据管理

- **多项目管理** — 每个项目独立管理标签、任务和数据
- **任务分配与审核** — 管理员分配任务，审核员审核标注结果
- **数据导出** — 支持 YOLO 格式（含 OBB）、COCO 格式
- **多角色权限** — 管理员 / 标注员 / 审核员

## 快速开始

### Docker 部署（推荐）

```bash
# 拉取镜像
sudo docker pull registry.cn-hangzhou.aliyuncs.com/metriccube3/mclabeling:latest
sudo docker tag xxxxx mclabeling:latest

# 克隆项目并部署
git clone https://github.com/MetricCube3/McLabeling.git
cd McLabeling
# 下载 sam2.1_l 到 McLabeling 目录下
chmod +x deploy.sh
sudo bash deploy.sh
```

### 本地部署

```bash
git clone https://github.com/MetricCube3/McLabeling.git
cd McLabeling
# 下载 sam2.1_l 到 McLabeling 目录下
pip install -r requirements.txt
python main.py
```

### 登录

访问 `http://ip:3000`，默认管理员账号：

| 用户名 | 密码 |
|:---:|:---:|
| `admin` | `admin` |

## 使用文档

📖 详细使用说明：**[使用文档](doc/user_guide.md)** · **[手动标注操作详解](doc/manual_annotation_guide.md)**

## 更新日志

| 日期 | 更新内容 |
|:---|:---|
| `2026-05-14` | 支持对已标注对象进行编辑（顶点拖拽、插入顶点、顶点删除、矩形/OBB 整体平移等操作） |
| `2026-05-12` | 增加 OBB（旋转框）标注功能；新增 YOLO-OBB 格式数据导出 |
| `2026-04-29` | 增加手动标注功能，包括矩形框和多边形标注 |
| `2026-04-27` | 前端代码模块化改造，优化标注界面功能 |
| `2026-04-16` | 首个版本发布 |

更多信息请查看 **[CHANGELOG](doc/changelog.md)**

## 开源协议

本项目采用 [MIT](LICENSE) 协议开源。
