#!/bin/bash

#############################################
# McLabeling 标注平台一键部署脚本
# 功能：自动构建Docker镜像并启动服务
#############################################

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印标题
print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  McLabeling 标注平台 - 一键部署脚本${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

# 检查必需的命令
check_requirements() {
    print_info "检查系统依赖..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_success "系统依赖检查通过"
}

# 检查环境文件
check_env_file() {
    print_info "检查环境配置文件..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "已创建 .env 文件"
        else
            print_warning ".env.example 也不存在，将使用默认配置"
        fi
    else
        print_success ".env 文件已存在"
    fi
}

# 检查SAM模型文件（可选，基础镜像应已包含）
check_sam_model() {
    print_info "检查SAM模型文件（可选）..."
    
    if [ -f "sam2.1_l.pt" ]; then
        print_success "本地SAM模型文件存在，将挂载到容器"
    else
        print_info "本地无SAM模型文件，将使用基础镜像中的模型"
    fi
}

# 创建必要的目录
create_directories() {
    print_info "创建必要的目录..."
    
    mkdir -p data/{videos,images,annotated/{success,review},extraction_info,image_zips}
    mkdir -p static/{covers,temp}
    
    print_success "目录创建完成"
}

# 停止并删除旧容器
stop_old_containers() {
    print_info "停止旧容器（如果存在）..."
    
    if docker ps -a | grep -q mclabeling_app; then
        docker-compose down || docker compose down
        print_success "旧容器已停止并删除"
    else
        print_info "没有运行的旧容器"
    fi
}

# 构建Docker镜像
build_image() {
    print_info "开始构建Docker镜像..."
    print_warning "这可能需要几分钟时间，请耐心等待..."
    
    if docker-compose build --no-cache 2>/dev/null || docker compose build --no-cache; then
        print_success "Docker镜像构建完成"
    else
        print_error "Docker镜像构建失败"
        exit 1
    fi
}

# 启动服务
start_service() {
    print_info "启动服务..."
    
    if docker-compose up -d 2>/dev/null || docker compose up -d; then
        print_success "服务启动成功"
    else
        print_error "服务启动失败"
        exit 1
    fi
}

# 等待服务健康
wait_for_health() {
    print_info "等待服务就绪..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker exec mclabeling_app python3 -c "import requests; requests.get('http://localhost:3000/health', timeout=2)" &> /dev/null; then
            print_success "服务已就绪"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    print_warning "服务健康检查超时，请手动检查日志"
}

# 显示服务状态
show_status() {
    echo ""
    print_info "查看服务状态..."
    docker-compose ps 2>/dev/null || docker compose ps
    
    echo ""
    print_success "部署完成！"
    echo ""
    echo -e "${GREEN}访问地址: ${NC}http://localhost:3000"
    echo -e "${GREEN}健康检查: ${NC}http://localhost:3000/health"
    echo ""
    echo -e "${YELLOW}常用命令:${NC}"
    echo "  查看日志: docker-compose logs -f mclabeling"
    echo "  停止服务: docker-compose down"
    echo "  重启服务: docker-compose restart"
    echo "  进入容器: docker exec -it mclabeling_app bash"
    echo ""
}

# 主函数
main() {
    print_header
    
    check_requirements
    check_env_file
    check_sam_model
    create_directories
    stop_old_containers
    build_image
    start_service
    wait_for_health
    show_status
}

# 执行主函数
main
