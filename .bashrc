#!/data/data/com.termux/files/usr/bin/bash
#MIT License

#Copyright (c) 2025 Web_LDix

#Permission is hereby granted, free of charge, to any person obtaining a copy
#of this software and associated documentation files (the "Software"), to deal
#in the Software without restriction, including without limitation the rights
#to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
#copies of the Software, and to permit persons to whom the Software is
#furnished to do so, subject to the following conditions:

#The above copyright notice and this permission notice shall be included in all
#copies or substantial portions of the Software.

#THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
#IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
#AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
#OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
#SOFTWARE.
# ==============================================
# ████████╗███████╗██████╗ ███╗   ███╗██╗   ██╗
# ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║╚██╗ ██╔╝
#    ██║   █████╗  ██████╔╝██╔████╔██║ ╚████╔╝
#    ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║  ╚██╔╝
#    ██║   ███████╗██║  ██║██║ ╚═╝ ██║   ██║
#    ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝
# ==============================================
# >> 专业级 Termux 环境配置 v1.00 (Optimized)
# >> 最后更新: 2025-03-29 (Optimized 2025-03-29)
# >> 作者: Web_LDix

# ----------------------------------------------
# 🔒 安全检测
# ----------------------------------------------
# 确保在 Termux 环境中运行
if [[ ! -d "/data/data/com.termux/files" ]]; then
    echo -e "\033[1;31m错误: 此配置仅适用于 Termux 环境\033[0m"
    return 1
fi

# 非交互模式直接退出
[[ $- != *i* ]] && return

# ----------------------------------------------
# 🔧 基础配置优化
# ----------------------------------------------
# 历史记录增强配置
export HISTSIZE=10000
export HISTFILESIZE=20000
export HISTCONTROL="erasedups:ignoreboth"
export HISTIGNORE="&:ls:ll:la:l:cd:pwd:exit:clear:history"
export HISTTIMEFORMAT="%F %T "  # 为历史记录添加时间戳
shopt -s histappend            # 多会话历史记录合并
shopt -s cmdhist               # 多行命令保存为单条记录

# 终端行为增强
shopt -s checkwinsize         # 自动适应窗口大小
shopt -s autocd               # 输入目录名自动跳转
shopt -s cdspell              # 自动纠正目录拼写错误
shopt -s direxpand            # 路径扩展时保留变量
shopt -s globstar             # 启用 ** 递归匹配

# ----------------------------------------------
# 🌍 环境变量优化
# ----------------------------------------------
# 基础路径配置
export TERMUX_HOME="/data/data/com.termux/files"
export TERMUX_PREFIX="$TERMUX_HOME/usr"
export PATH="$TERMUX_PREFIX/bin:$TERMUX_PREFIX/bin/applets:$PATH"

# 开发环境配置
export EDITOR="micro"         # 现代编辑器
export VISUAL="$EDITOR"
export PAGER="less"
export MANPAGER="less -R"     # 彩色 man 页面
export LESS="-R -X -F"        # 优化 less 行为

# 智能检测存储路径
if [[ -d "/storage/emulated/0" ]]; then
    export ANDROID_STORAGE="/storage/emulated/0"
elif [[ -d "/sdcard" ]]; then
    export ANDROID_STORAGE="/sdcard"
fi

# ----------------------------------------------
# 🎨 高级提示符 (Powerline 风格增强版)
# ----------------------------------------------
__ps1() {
    local EXIT_CODE="$?"
    local RED="\e[1;31m"
    local GREEN="\e[1;32m"
    local YELLOW="\e[1;33m"
    local BLUE="\e[1;34m"
    local PURPLE="\e[1;35m"
    local CYAN="\e[1;36m"
    local RESET="\e[0m"
    local BOLD="\e[1m"

    # Git 分支检测
    local git_branch=""
    if command -v git &>/dev/null; then
        git_branch=$(git branch 2>/dev/null | grep '^*' | colrm 1 2)
        if [[ -n "$git_branch" ]]; then
            # 添加 Git 状态指示
            local git_status=$(git status --porcelain 2>/dev/null)
            if [[ -n "$git_status" ]]; then
                git_branch=" ⎇ ${git_branch} ●"
            else
                git_branch=" ⎇ ${git_branch}"
            fi
        fi
    fi

    # 时间 + 用户名 + 主机名
    PS1="${PURPLE}⌚ \t ${BOLD}${GREEN}➜ ${CYAN}\u@\h${RESET}"

    # 当前路径 (自动缩短家目录)
    local current_path="\w"
    [[ "$PWD" == "$HOME" ]] && current_path="~"
    PS1+=" ${BLUE}📁 ${current_path}${RESET}"

    # Git 分支显示
    [[ -n "$git_branch" ]] && PS1+="${YELLOW}${git_branch}${RESET}"

    # 上条命令状态指示
    if [[ "$EXIT_CODE" != 0 ]]; then
        PS1+=" ${RED}✘${EXIT_CODE}${RESET}"
    else
        PS1+=" ${GREEN}✓${RESET}"
    fi

    # 终端提示符
    PS1+="\n${BOLD}${GREEN}❯${RESET} "
}
PROMPT_COMMAND=__ps1

# ----------------------------------------------
# ⚡ 智能补全增强
# ----------------------------------------------
if [ -f "$TERMUX_PREFIX/share/bash-completion/bash_completion" ]; then
    . "$TERMUX_PREFIX/share/bash-completion/bash_completion"
elif [ -f "$TERMUX_PREFIX/etc/profile.d/bash_completion.sh" ]; then
    . "$TERMUX_PREFIX/etc/profile.d/bash_completion.sh"
fi

# 自定义命令补全
command -v pkg &>/dev/null && complete -o default -F _pkg pkg

# ----------------------------------------------
# 🛠️ 专业实用函数库
# ----------------------------------------------

# 📁 智能目录创建与跳转 (增强版)
mkcd() {
    if [[ $# -eq 0 ]]; then
        echo "用法: mkcd <目录名>"
        return 1
    fi
    mkdir -p "$@" && cd "${@: -1}" || {
        echo -e "\033[1;31m错误: 无法创建目录 '$@'\033[0m"
        return 1
    }
}

# 🔍 专业搜索工具
search() {
    if [[ $# -eq 0 ]]; then
        echo "用法:"
        echo "  search [模式] - 搜索文件名"
        echo "  search [内容] [文件模式] - 搜索文件内容"
        echo "示例:"
        echo "  search '*.sh'"
        echo "  search 'function' *.sh"
        return 1
    fi

    if [[ $# -eq 1 ]]; then
        echo -e "\033[1;34m🔍 搜索文件名匹配 '$1' 的文件:\033[0m"
        find . -type f -iname "$1" 2>/dev/null
    else
        local pattern="$1"
        shift
        echo -e "\033[1;34m🔍 在 ${@} 中搜索内容 '$pattern':\033[0m"
        grep --color=auto -rnw "$@" -e "$pattern" 2>/dev/null
    fi
}

# 📦 Termux 包管理增强
pkg-up() {
    echo -e "\033[1;36m🔄 更新软件包列表...\033[0m"
    pkg update || {
        echo -e "\033[1;31m错误: 更新失败\033[0m"
        return 1
    }
    
    echo -e "\033[1;36m⚡ 升级所有软件包...\033[0m"
    pkg upgrade -y || {
        echo -e "\033[1;31m警告: 部分包升级失败\033[0m"
    }
    
    echo -e "\033[1;36m🧹 清理无用包...\033[0m"
    pkg autoclean
    
    echo -e "\033[1;32m✅ 系统更新完成!\033[0m"
    echo -e "\033[1;33m已安装包: $(pkg list-installed | wc -l)\033[0m"
}

# 📊 系统信息工具
sysinfo() {
    echo -e "\n\033[1;36m🖥️  系统信息\033[0m"
    echo "----------------------------------"
    echo -e "\033[1;33m💻 设备型号: \033[0m$(getprop ro.product.model)"
    echo -e "\033[1;33m📱 Android 版本: \033[0m$(getprop ro.build.version.release)"
    echo -e "\033[1;33m🔄 Termux 版本: \033[0m$(pkg show termux-api | grep Version | awk '{print $2}')"
    echo -e "\033[1;33m🐧 内核版本: \033[0m$(uname -r)"
    echo -e "\033[1;33m⏳ 运行时间: \033[0m$(uptime -p | sed 's/up //')"
    echo -e "\033[1;33m💾 存储空间: \033[0m$(df -h $PWD | awk 'NR==2 {print $4}') 可用"
    echo -e "\033[1;33m🧠 内存使用: \033[0m$(free -m | awk 'NR==2 {printf "%.1f%% of %dMB", $3*100/$2, $2}')"
    echo "----------------------------------"
}

# ----------------------------------------------
# 🎯 专业别名系统
# ----------------------------------------------

# 🔄 系统快捷方式
alias refresh="source ~/.bashrc"
alias bashrc="$EDITOR ~/.bashrc"
alias reload="exec bash"

# 📁 文件列表增强
alias ls="ls -F --color=auto"
alias ll="ls -lh --color=auto"
alias la="ls -lha --color=auto"
alias lt="ls -lhtr --color=auto"  # 按时间排序

# 🔍 搜索增强
alias grep="grep --color=auto"
alias egrep="egrep --color=auto"
alias fgrep="fgrep --color=auto"

# 📦 包管理快捷方式
alias pkg-in="pkg install"
alias pkg-rm="pkg uninstall"
alias pkg-list="pkg list-installed"

# 🔒 权限管理
alias perm="stat -c '%a %n'"
alias 755="chmod 755 -v"
alias 644="chmod 644 -v"

# 📝 日志查看
alias logcat="logcat -d -v time"

# ----------------------------------------------
# 📚 帮助系统
# ----------------------------------------------
helpme() {
    echo -e "\033[1;36m🛠️  Termux 专业配置帮助\033[0m"
    echo "----------------------------------"
    echo -e "\033[1;33m系统命令:\033[0m"
    echo "  refresh  - 刷新配置"
    echo "  bashrc   - 编辑配置文件"
    echo "  sysinfo  - 显示系统信息"
    echo "  pkg-up   - 更新所有软件包"
    
    echo -e "\n\033[1;33m文件管理:\033[0m"
    echo "  ls, ll, la, lt - 增强的文件列表"
    echo "  mkcd <dir>     - 创建并进入目录"
    echo "  search <模式>  - 搜索文件或内容"
    
    echo -e "\n\033[1;33m开发工具:\033[0m"
    echo "  perm <文件> - 查看权限"
    echo "  755/644 <文件> - 设置权限"
    echo "----------------------------------"
    echo -e "输入 \033[1;32mman <命令>\033[0m 获取详细帮助"
}

# ----------------------------------------------
# 🚀 专业启动信息
# ----------------------------------------------
clear
if command -v figlet &>/dev/null; then
    echo -e "\033[1;36m$(figlet -f slant Termux)\033[0m"
else
    echo -e "\033[1;36mTermux 专业环境\033[0m"
fi

echo -e "\033[1;32m✨ 您的移动端 Linux 专业环境已就绪！\033[0m"
echo -e "\033[1;33m🖥️  主机: \033[0m$(hostname)"
echo -e "\033[1;33m🐧 系统: \033[0m$(uname -srm)"
echo -e "\033[1;33m📅 日期: \033[0m$(date +'%Y-%m-%d %H:%M:%S')"
echo -e "\033[1;33m📦 软件包: \033[0m$(pkg list-installed | wc -l) 个已安装"
echo -e "\033[1;33m💾 存储: \033[0m$(df -h $PWD | awk 'NR==2 {print $4}') 可用"

# 显示重要提醒
echo -e "\n\033[1;35m💡 提示: 输入 \033[1;36mhelpme\033[1;35m 查看快捷命令\033[0m"
echo -e "\033[1;31m⚠ 警告: 请勿滥用 root 权限\033[0m"
