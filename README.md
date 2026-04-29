# 玻璃材料替代查询与 Nd-Vd 图

这是一个离线可用、也可通过 GitHub Pages 托管访问的光学材料查询网页，用于快速浏览 CDGM、NHG 和塑料光学材料库中的材料参数、标签、相近替代关系以及 Nd-Vd 分布。

## 在线访问

如果已经启用 GitHub Pages，可通过以下地址访问：

```text
https://lssnake0105.github.io/glass-material-explorer/
```

也可以直接下载仓库后，在本地打开 `index.html` 或 `material_explorer.html`。

## 主要功能

- 按材料名称搜索，并在 Nd-Vd 图中高光显示。
- 按材料库、材料族、自动标签、自定义标签和数值范围筛选。
- 绘制全局 Nd-Vd 图，支持缩放、平移、点击选中材料。
- 显示选中材料附近的局部 Nd-Vd 切片，方便查看聚集区域。
- 基于 Nd、Vd、dPgF、密度、成本、材料类别和材料族，给出综合相近替代候选。
- 默认隐藏 IRG/HWS 红外材料，避免干扰普通可见光摄影镜头材料筛选。
- 支持自定义 tag，并保存在浏览器本地；可导入/导出 JSON。

## 文件说明

| 文件 | 说明 |
|---|---|
| `index.html` | GitHub Pages 默认入口文件 |
| `material_explorer.html` | 主要网页文件，可直接本地打开 |
| `build_material_explorer.js` | 从 TXT 材料库重新生成网页的脚本 |
| `CDGM-ZEMAX202409.txt` | CDGM 材料库数据 |
| `NHG202501.txt` | NHG 材料库数据 |
| `PLASTIC2020.txt` | 塑料光学材料库数据 |
| `material_naming_guide.html` | 材料命名、前缀后缀和材料族解释文档 |
| `materials_parsed.csv` / `name_tokens.csv` | 辅助解析结果 |

## 更新材料库数据

如果 TXT 材料库有更新，先替换对应的 TXT 文件，然后在仓库根目录运行：

```powershell
node .\build_material_explorer.js
Copy-Item .\material_explorer.html .\index.html
```

随后提交并推送：

```powershell
git add .
git commit -m "Update material explorer data"
git push
```

## 启用 GitHub Pages

在 GitHub 仓库页面进入：

```text
Settings -> Pages
```

然后设置：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

保存后等待几分钟，即可通过 GitHub Pages 地址访问。

## 注意事项

- 本工具用于材料替代关系的初筛，不替代 Zemax/OpticStudio 中的重新优化、热分析和公差分析。
- 网页中已经内嵌材料库数据；如果仓库是公开的，材料数据也会公开。
- 未公开确认的命名标记，例如 `S-`、`L-`、`@MY`、`*`，仅作为标签和筛选项使用，不赋予确定物理含义。
