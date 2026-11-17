# 大学生作息调查网页

这是一个无需第三方依赖的问卷小站，包含填写页、答卷收集服务端和 CSV 导出页。

## 启动

1. 安装 Node.js 22 或更新版本。
2. 在此文件夹打开终端，运行：

   ```powershell
   node server.js
   ```

3. 浏览器访问终端显示的填写页地址（默认 `http://localhost:8080`）。
4. 分享本机局域网 IP 加端口，例如 `http://192.168.1.20:8080`，同一网络中的填写者即可访问。若需公网填写，需要部署到支持 Node.js 的服务器并启用 HTTPS。

首次启动会在终端显示管理口令。打开 `/admin` 并输入口令下载 CSV。导出时口令通过请求头提交，不出现在网址中。答卷以 JSON 形式保存在本目录的 `responses.json`，CSV 中的多选题按“选中=1、未选=0”展开，单选题保留选项文字，量表题保留 1–5 分。

可通过环境变量 `PORT` 设置端口，通过 `SURVEY_ADMIN_TOKEN` 指定管理口令：

```powershell
$env:PORT = '8080'
$env:SURVEY_ADMIN_TOKEN = '换成你自己的长口令'
$env:DATA_DIR = 'C:\survey-data'
node server.js
```

## 公网部署

部署时必须将 `SURVEY_ADMIN_TOKEN` 设置为平台的机密环境变量，并将 `DATA_DIR` 指向持久化磁盘或持久数据库挂载目录。不要把管理口令或 `responses.json` 提交到代码仓库。平台应提供 HTTPS/TLS；HTTPS 在平台边缘终止后，应用内部可继续监听平台提供的 `PORT`。部署前确认持久化存储和费用方案，避免服务重启或重新部署时丢失答卷。

已附带 `render.yaml`。在 Render Blueprint 部署时，它配置 Starter Web Service、1 GB 持久磁盘、数据目录和随机管理口令。Render 当前列出的 Starter Web Service 价格为约 $7/月，持久磁盘按 $0.25/GB/月计；1 GB 配置预计约 $7.25/月，另计超额流量等费用。请在 Render 创建资源前核对当时的价格并确认付费。

## 数据说明

问卷匿名，不要求姓名、学号或联系方式。每条答卷记录提交时间。请将 `responses.json` 和导出的 CSV 当作研究数据妥善保存。停止服务后重新运行，已有答卷仍保留在 JSON 文件中。

