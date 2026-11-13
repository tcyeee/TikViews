# TikTok 视频播放量批量查询 — 前端

本目录是 [TikTok 视频播放量批量查询工具](../README.md) 的前端部分，基于 React + Vite 构建，负责：

- 上传指定格式的视频列表 Excel 文件；
- 展示批量查询的进度与状态；
- 查看本批次的明细结果（每条视频的最新播放量、查询状态、原因说明、抓取时间）与汇总统计；
- 下载查询结果（CSV / `.xlsx`）。

完整需求与验收标准见根目录 [TODO.md](../TODO.md)。

---

以下为 Vite 脚手架自带说明，供开发参考：

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
