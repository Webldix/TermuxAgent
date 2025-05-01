# Termux-Pro-Env

专业级 Termux 配置工具集，提供增强的 Bash 环境、Powerline 风格提示符、Git 集成和系统管理工具。包含智能补全、一键更新、高级搜索等功能，优化 Android 终端体验。

## ✨ 功能特性

- 🎨 **Powerline 风格增强提示符** - 显示 Git 分支、命令状态和时间戳
- ⚡ **性能优化** - 经过调优的 Bash 配置，响应速度更快
- 🔍 **高级搜索工具** - 支持文件名和内容搜索
- 📦 **包管理增强** - 一键更新所有软件包
- 📊 **系统信息面板** - 显示设备信息和资源使用情况
- 🛠️ **实用函数库** - 包含 `mkcd`、`search` 等高效工具

## 🚀 快速安装

安装完成后建议重启终端或执行：
```bash
source ~/.bashrc
```

## 🛠️ 使用说明

### 核心命令
| 命令       | 描述                          |
|------------|-------------------------------|
| `helpme`   | 显示所有可用命令              |
| `pkg-up`   | 更新所有软件包                |
| `sysinfo`  | 显示系统信息                  |
| `mkcd`     | 创建目录并自动进入            |
| `search`   | 高级文件搜索工具              |

### 常用别名
```bash
# 文件管理
alias ll='ls -lh --color=auto'
alias la='ls -lha --color=auto'

# 系统维护
alias refresh='source ~/.bashrc'
alias bashrc='micro ~/.bashrc'
```

## 🤝 参与贡献

1. Fork 本仓库
2. 新建分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 新建 Pull Request

## 📜 许可证
```text
MIT License

Copyright (c) 2025 Web_LDix

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
