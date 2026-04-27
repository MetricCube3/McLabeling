# 标注平台 - 使用预构建镜像
FROM mclabeling:latest

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Asia/Shanghai

WORKDIR /workspace

COPY . .

RUN mkdir -p data/videos data/images data/annotated/success data/annotated/review \
    static/covers static/temp data/extraction_info data/image_zips

# 暴露端口
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import requests; requests.get('http://localhost:3000/health', timeout=5)" || exit 1

# 启动命令
CMD ["python3", "main.py"]
