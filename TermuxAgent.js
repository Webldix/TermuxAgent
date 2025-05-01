const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const events = require('events');
const os = require('os');

// 配置
const 接口地址 = "xxx";
const 模型 = "xxx/xxx";
const 密钥 = "xxx";
const 提示词 = `你是一个拥有完整系统操作权限的自主智能体，负责执行用户提出的任务，目标是高效、安全地完成任务，并提供清晰的反馈，核心原则为安全第一、谨慎操作、分步执行、详细反馈、错误处理；操作规范包括**严格使用**JSON格式执行命令，JSON必须是一行且不包含多余内容，格式为{"command":"命令名称","args":["参数1","参数2"]}；**命令必须且只能从以下列表中选择**：exec, readFile, writeFile, appendFile, cd, ls, pwd, httpGet, httpPost, systemInfo, delay；工作流程为接收任务、分解步骤、生成命令、执行并记录结果、调整或报告；避免事项包括避免系统崩溃/数据丢失、未经授权访问、泄露敏感信息、无限循环、直接执行未验证的用户命令；你的角色是一位经验丰富的系统管理员，具备强大的技术能力和严谨的工作态度，请以专业的视角思考和行动，确保任务的安全、可靠和高效完成。**在你的所有回复中，如果需要执行操作，必须严格按照JSON格式，并且命令必须是允许的命令之一。不允许使用任何其他格式或命令。**`;
const VERSION = "0.2.3";
const AUTHOR = "WebLDix";

// 创建事件发射器
const eventEmitter = new events.EventEmitter();

// 状态管理
const state = {
  currentWorkingDir: process.cwd(),
  chatHistory: [
    {
      role: "system",
      content: 提示词
    }
  ],
  operationHistory: [],
  isProcessing: false,
  currentTask: null,
  currentStep: 0,
  maxSteps: 15,
  safetyChecks: {
    dangerousCommands: ['rm -rf', 'mkfs', 'dd', 'sudo rm'],
    sensitivePatterns: ['password', 'token', 'secret', 'key', 'credential', 'apikey']
  },
  // 优化后的 temperature 控制
  temperatureControl: {
    baseTemperature: 0.7,
    currentTemperature: 0.7,
    adjustmentFactor: 0.15,
    maxTemperature: 1.3,
    minTemperature: 0.2,
    lastAdjustment: null
  },
  taskPlanning: {
    currentPlan: null,
    estimatedSteps: 0,
    complexity: 'medium'
  }
};

// 带颜色的输出
const colored = {
  agent: text => `\x1b[33m${text}\x1b[0m`,
  error: text => `\x1b[31m${text}\x1b[0m`,
  success: text => `\x1b[32m${text}\x1b[0m`,
  info: text => `\x1b[36m${text}\x1b[0m`,
  debug: text => `\x1b[35m${text}\x1b[0m`,
  warning: text => `\x1b[33m${text}\x1b[0m`
};

// 平台检测
const platform = {
  isLinux: process.platform === 'linux',
  isAndroid: process.platform === 'android' || (process.platform === 'linux' && process.env.PREFIX && process.env.PREFIX.includes('com.termux'))
};

// 安全检查函数
function performSafetyCheck(command, args) {
  const fullCommand = [command, ...args].join(' ').toLowerCase();

  for (const dangerCmd of state.safetyChecks.dangerousCommands) {
    if (fullCommand.includes(dangerCmd.toLowerCase())) {
      throw new Error(`安全警告: 检测到潜在危险命令 "${dangerCmd}"`);
    }
  }

  for (const pattern of state.safetyChecks.sensitivePatterns) {
    if (args.some(arg => arg.toLowerCase().includes(pattern))) {
      console.log(colored.warning(`警告: 检测到可能包含敏感信息的参数 "${pattern}"`));
    }
  }

  return true;
}

// 评估命令复杂度
function assessCommandComplexity(command, args) {
  const complexCommands = ['exec', 'httpPost', 'writeFile'];
  const simpleCommands = ['readFile', 'ls', 'pwd', 'systemInfo'];
  
  if (complexCommands.includes(command)) return 'high';
  if (simpleCommands.includes(command)) return 'low';
  return 'medium';
}

// 获取重试次数
function getRetryCount(command) {
  return state.operationHistory
    .filter(op => op.command === command)
    .length;
}

// 优化后的智能 temperature 调节函数
function adjustTemperature(executionResult) {
  const { temperatureControl } = state;
  
  // 分析执行结果
  const lastOperation = state.operationHistory[state.operationHistory.length - 1];
  const lastCommand = lastOperation ? lastOperation.command : null;
  
  // 根据执行结果类型调整
  if (executionResult.success) {
    // 成功执行后的策略
    if (executionResult.complexity === 'high') {
      // 复杂任务成功后小幅降低 temperature 以保持稳定性
      temperatureControl.currentTemperature = Math.max(
        temperatureControl.minTemperature,
        temperatureControl.currentTemperature - (temperatureControl.adjustmentFactor * 0.5)
      );
    } else {
      // 简单任务成功后正常降低 temperature
      temperatureControl.currentTemperature = Math.max(
        temperatureControl.minTemperature,
        temperatureControl.currentTemperature - temperatureControl.adjustmentFactor
      );
    }
  } else {
    // 失败后的策略
    if (executionResult.retryCount > 2) {
      // 多次重试后大幅提高 temperature 以尝试新方法
      temperatureControl.currentTemperature = Math.min(
        temperatureControl.maxTemperature,
        temperatureControl.currentTemperature + (temperatureControl.adjustmentFactor * 2)
      );
    } else {
      // 首次失败后适度提高 temperature
      temperatureControl.currentTemperature = Math.min(
        temperatureControl.maxTemperature,
        temperatureControl.currentTemperature + temperatureControl.adjustmentFactor
      );
    }
  }
  
  // 根据命令类型微调
  if (lastCommand) {
    switch(lastCommand) {
      case 'exec':
        // 执行系统命令需要更确定性
        temperatureControl.currentTemperature = Math.max(
          temperatureControl.minTemperature,
          temperatureControl.currentTemperature * 0.9
        );
        break;
      case 'httpGet':
      case 'httpPost':
        // API调用需要一定创造性
        temperatureControl.currentTemperature = Math.min(
          temperatureControl.maxTemperature,
          temperatureControl.currentTemperature * 1.1
        );
        break;
    }
  }
  
  // 确保在合理范围内
  temperatureControl.currentTemperature = Math.max(
    temperatureControl.minTemperature,
    Math.min(temperatureControl.maxTemperature, temperatureControl.currentTemperature)
  );
  
  // 记录调整信息
  temperatureControl.lastAdjustment = {
    timestamp: new Date().toISOString(),
    newValue: temperatureControl.currentTemperature,
    reason: executionResult.reason || '正常调整',
    command: lastCommand
  };
  
  console.log(colored.debug(`智能调节 temperature: ${temperatureControl.currentTemperature.toFixed(2)}`));
  console.log(colored.debug(`调整原因: ${executionResult.reason || '正常调整'}`));
}

// 评估任务复杂度
function assessTaskComplexity(task) {
  const complexKeywords = ['复杂', '多个', '整合', '处理', '分析', '自动化'];
  const simpleKeywords = ['查看', '状态', '信息', '读取', '简单'];
  
  const complexCount = complexKeywords.filter(kw => task.includes(kw)).length;
  const simpleCount = simpleKeywords.filter(kw => task.includes(kw)).length;
  
  if (complexCount > simpleCount + 2) {
    state.taskPlanning.complexity = 'high';
    state.temperatureControl.currentTemperature = state.temperatureControl.baseTemperature + 0.3;
    return 'high';
  } else if (simpleCount > complexCount + 2) {
    state.taskPlanning.complexity = 'low';
    state.temperatureControl.currentTemperature = state.temperatureControl.baseTemperature - 0.2;
    return 'low';
  } else {
    state.taskPlanning.complexity = 'medium';
    state.temperatureControl.currentTemperature = state.temperatureControl.baseTemperature;
    return 'medium';
  }
}

// 命令集 (保持不变)
const commandSet = {
  readFile: (filePath) => {
    try {
      const fullPath = path.resolve(state.currentWorkingDir, filePath);
      if (!fs.existsSync(fullPath)) {
        return `错误: 文件不存在: ${fullPath}`;
      }
      return fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      throw new Error(`读取文件失败: ${error.message}`);
    }
  },

  writeFile: (filePath, content) => {
    try {
      const fullPath = path.resolve(state.currentWorkingDir, filePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content);
      return `文件已写入: ${fullPath}`;
    } catch (error) {
      throw new Error(`写入文件失败: ${error.message}`);
    }
  },

  appendFile: (filePath, content) => {
    try {
      const fullPath = path.resolve(state.currentWorkingDir, filePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.appendFileSync(fullPath, content);
      return `内容已追加到: ${fullPath}`;
    } catch (error) {
      throw new Error(`追加文件失败: ${error.message}`);
    }
  },

  cd: (dir) => {
    try {
      const newPath = path.resolve(state.currentWorkingDir, dir);
      if (!fs.existsSync(newPath)) {
        throw new Error(`目录不存在: ${newPath}`);
      }
      if (!fs.statSync(newPath).isDirectory()) {
        throw new Error(`不是目录: ${newPath}`);
      }
      state.currentWorkingDir = newPath;
      return `当前工作目录: ${newPath}`;
    } catch (error) {
      throw new Error(`切换目录失败: ${error.message}`);
    }
  },

  ls: (dirOrOptions = '.') => {
    try {
      let targetPath = '.';
      let options = [];

      if (Array.isArray(dirOrOptions)) {
        options = dirOrOptions.filter(opt => opt.startsWith('-'));
        const nonOptions = dirOrOptions.filter(opt => !opt.startsWith('-'));
        if (nonOptions.length > 0) {
          targetPath = nonOptions[0];
        }
      } else if (typeof dirOrOptions === 'string') {
        if (dirOrOptions.startsWith('-')) {
          options = [dirOrOptions];
        } else {
          targetPath = dirOrOptions;
        }
      }

      const fullPath = path.resolve(state.currentWorkingDir, targetPath);

      if (!fs.existsSync(fullPath)) {
        return `错误: 路径不存在: ${fullPath}`;
      }

      let items = fs.readdirSync(fullPath);
      const showHidden = options.some(opt => opt.includes('a'));
      if (!showHidden) {
        items = items.filter(item => !item.startsWith('.'));
      }

      const showDetails = options.some(opt => opt.includes('l'));
      if (showDetails) {
        const formattedItems = items.map(item => {
          const itemPath = path.join(fullPath, item);
          const stats = fs.statSync(itemPath);
          const isDir = stats.isDirectory();
          const size = stats.size;
          const sizeStr = options.some(opt => opt.includes('h'))
            ? formatFileSize(size)
            : size.toString();
          const modified = stats.mtime.toISOString();
          return `${isDir ? 'd' : '-'} ${item.padEnd(30)} ${sizeStr.padEnd(10)} ${modified}`;
        });

        return `总计 ${items.length} 个项目:\n${formattedItems.join('\n')}`;
      } else {
        return items.join('\n');
      }
    } catch (error) {
      throw new Error(`列出目录失败: ${error.message}`);
    }
  },

  pwd: () => {
    return state.currentWorkingDir;
  },

  exec: (command) => {
    try {
      if (!command || typeof command !== 'string') {
        throw new Error('命令不能为空');
      }

      if (!performSafetyCheck('exec', [command])) {
        throw new Error('命令未通过安全检查');
      }

      return execSync(command, {
        encoding: 'utf8',
        cwd: state.currentWorkingDir,
        timeout: 30000
      });
    } catch (error) {
      throw new Error(`执行命令失败: ${error.message}`);
    }
  },

  httpGet: async (url) => {
    try {
      new URL(url);
      const response = await axios.get(url, { timeout: 10000 });
      return JSON.stringify(response.data, null, 2);
    } catch (error) {
      throw new Error(`HTTP GET请求失败: ${error.message}`);
    }
  },

  httpPost: async (url, data) => {
    try {
      new URL(url);
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      const response = await axios.post(url, parsedData, { timeout: 10000 });
      return JSON.stringify(response.data, null, 2);
    } catch (error) {
      throw new Error(`HTTP POST请求失败: ${error.message}`);
    }
  },

  systemInfo: () => {
    try {
      const argZero = arguments[0];
      const info = {
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
        freeMemory: `${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`,
        uptime: `${Math.round(os.uptime() / 3600)} hours`,
        currentWorkingDir: state.currentWorkingDir,
        userInfo: os.userInfo().username,
        isLinux: platform.isLinux,
        isAndroid: platform.isAndroid,
        currentTime: new Date().toISOString()
      };

      if (argZero && typeof argZero === 'string') {
        if (info[argZero] !== undefined) {
          return info[argZero];
        } else {
          return `未知的系统信息字段: ${argZero}`;
        }
      }

      return JSON.stringify(info, null, 2);
    } catch (error) {
      throw new Error(`获取系统信息失败: ${error.message}`);
    }
  },

  delay: (ms) => {
    return new Promise(resolve => {
      const milliseconds = parseInt(ms);
      if (isNaN(milliseconds) || milliseconds < 0 || milliseconds > 60000) {
        resolve(`延迟参数无效，使用默认值1000ms`);
        setTimeout(() => resolve(`延迟1000ms完成`), 1000);
      } else {
        setTimeout(() => resolve(`延迟${milliseconds}ms完成`), milliseconds);
      }
    });
  }
};

// 工具函数
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// 执行引擎
async function executeCommand(command, args = []) {
  try {
    if (!commandSet[command]) {
      throw new Error(`未知命令: ${command}`);
    }

    const operation = {
      timestamp: new Date().toISOString(),
      command,
      args,
      cwd: state.currentWorkingDir
    };

    state.operationHistory.push(operation);

    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, `operations_${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, `${JSON.stringify(operation)}\n`);
    } catch (logError) {
      console.log(colored.warning(`日志记录失败: ${logError.message}`));
    }

    console.log(colored.info(`执行命令: ${command} ${args.join(' ')}`));
    console.log(colored.info(`工作目录: ${state.currentWorkingDir}`));

    const result = await commandSet[command](...args);
    
    // 调用智能调节 - 成功情况
    adjustTemperature({
      success: true,
      command: command,
      complexity: assessCommandComplexity(command, args),
      reason: '命令执行成功'
    });
    
    return colored.success(result);
  } catch (error) {
    // 调用智能调节 - 失败情况
    adjustTemperature({
      success: false,
      command: command,
      retryCount: getRetryCount(command),
      reason: `执行失败: ${error.message}`
    });
    
    return colored.error(`[执行错误] ${error.message}`);
  }
}

// 解析和执行AI生成的指令
async function parseAndExecuteAIResponse(response) {
  // 尝试从响应中提取JSON指令
  let jsonStart = response.indexOf('{');
  let jsonEnd = response.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    // 没有找到JSON指令，可能是普通响应
    state.chatHistory.push({
      role: "assistant",
      content: response
    });
    
    if (response.includes('任务完成') || response.includes('已完成')) {
      state.chatHistory.push({
        role: "system",
        content: "任务已标记为完成。"
      });
      return colored.success("任务已完成");
    }
    
    return colored.info("AI没有生成可执行指令");
  }

  try {
    const jsonStr = response.substring(jsonStart, jsonEnd + 1);
    const instruction = JSON.parse(jsonStr);
    
    if (!instruction.command || !commandSet[instruction.command]) {
      throw new Error(`无效的指令格式或未知命令: ${jsonStr}`);
    }

    const args = instruction.args || [];
    
    // 保存原始响应到聊天历史
    state.chatHistory.push({
      role: "assistant",
      content: response
    });

    const result = await executeCommand(instruction.command, args);
    
    // 更新聊天历史中的执行结果
    state.chatHistory.push({
      role: "system",
      content: `执行结果: ${instruction.command} ${args.join(' ')}:\n${result}`
    });
    
    return result;
  } catch (error) {
    state.chatHistory.push({
      role: "system",
      content: `指令解析失败: ${error.message}`
    });
    return colored.error(`指令解析失败: ${error.message}`);
  }
}

// 流式获取AI响应
async function getAIResponseStream(prompt) {
  return new Promise((resolve, reject) => {
    const messages = [
      ...state.chatHistory,
      {
        role: "user",
        content: prompt
      }
    ];

    let fullResponse = '';
    let buffer = '';

    console.log(colored.agent("\n--- AI思考内容如下 ---"));

    axios.post(接口地址, {
      model: `${模型}`,
      messages,
      temperature: state.temperatureControl.currentTemperature, // 使用动态调整的temperature
      max_tokens: 10000,
      stream: true
    }, {
      headers: {
        "Authorization": `Bearer ${密钥}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      responseType: 'stream',
      timeout: 60000
    }).then(response => {
      response.data.on('data', chunk => {
        const str = chunk.toString();
        buffer += str;

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                fullResponse += content;
                process.stdout.write(colored.agent(content));
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      response.data.on('end', () => {
        process.stdout.write('\n');
        resolve(fullResponse);
      });

      response.data.on('error', err => {
        reject(err);
      });
    }).catch(err => {
      reject(err);
    });
  });
}

// 任务处理器
async function processTask(task) {
  if (state.isProcessing) {
    console.log(colored.error("已有任务正在执行，请等待当前任务完成"));
    return;
  }

  state.isProcessing = true;
  state.currentTask = task;
  state.currentStep = 0;

  // 评估任务复杂度并初始化temperature
  const complexity = assessTaskComplexity(task);
  console.log(colored.debug(`任务复杂度评估: ${complexity}, 初始temperature: ${state.temperatureControl.currentTemperature.toFixed(2)}`));

  state.chatHistory.push({
    role: "user",
    content: `新任务: ${task}`
  });

  console.log(colored.agent(`\n开始执行任务: ${task}`));
  console.log(colored.info(`当前时间: ${new Date().toISOString()}`));

  try {
    // 获取任务分析和计划
    const planPrompt = `我需要执行以下任务: "${task}"
请分析这个任务并制定一个执行计划，包括:
1. 任务目标的明确定义
2. 需要执行的步骤列表
3. 可能遇到的风险和应对措施
4. 成功完成的标准

请以纯文本形式提供分析和计划，不要包含任何JSON指令。`;

    console.log(colored.info('\n获取任务分析和计划...'));
    const planResponse = await getAIResponseStream(planPrompt);

    state.chatHistory.push({
      role: "assistant",
      content: planResponse
    });

    state.chatHistory.push({
      role: "system",
      content: "任务分析和计划已完成，开始执行具体步骤。"
    });

    // 执行任务步骤
    while (state.currentStep < state.maxSteps) {
      state.currentStep++;

      const operationHistorySummary = state.operationHistory
        .slice(-5)
        .map(op => `- ${op.timestamp}: ${op.command} ${op.args.join(' ')}`)
        .join('\n');

      const prompt = `当前任务进度：
目标：${task}
当前步骤：${state.currentStep}/${state.maxSteps}
当前工作目录：${state.currentWorkingDir}
最近操作历史：
${operationHistorySummary}

请生成第${state.currentStep}步操作指令。**所有指令必须通过严格的JSON格式执行，格式为{"command":"命令名称","args":["参数1","参数2"]}，且必须是一行不包含多余内容。**
如果任务已完成，请明确说明"任务已完成"，并总结执行结果。`;

      // 1. 获取AI响应（流式）
      const response = await getAIResponseStream(prompt);

      // 2. 解析并执行AI指令
      console.log(colored.info('\n执行指令中...'));
      const result = await parseAndExecuteAIResponse(response);
      console.log(colored.success(`执行结果:\n${result}`));

      // 3. 检查任务是否完成
      if (response.includes('任务完成') || response.includes('任务已完成')) {
        console.log(colored.success('\n任务完成！'));

        state.chatHistory.push({
          role: "system",
          content: `任务"${task}"已完成，共执行了${state.currentStep}个步骤。`
        });

        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (state.currentStep >= state.maxSteps) {
      console.log(colored.error(`\n达到最大步骤数(${state.maxSteps})，任务终止`));

      state.chatHistory.push({
        role: "system",
        content: `任务"${task}"已达到最大步骤数(${state.maxSteps})，自动终止。`
      });
    }
  } catch (error) {
    console.log(colored.error(`任务执行出错: ${error.message}`));

    state.chatHistory.push({
      role: "system",
      content: `任务执行出错: ${error.message}`
    });
  } finally {
    state.isProcessing = false;
    console.log(colored.info(`任务"${state.currentTask}"处理完毕`));
    state.currentTask = null;
    state.currentStep = 0;
    eventEmitter.emit('taskComplete');
  }
}

// 保存聊天历史
function saveChatHistory() {
  try {
    const historyDir = path.join(process.cwd(), 'history');
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const historyFile = path.join(historyDir, `chat_history_${timestamp}.json`);

    fs.writeFileSync(historyFile, JSON.stringify(state.chatHistory, null, 2));
    console.log(colored.info(`聊天历史已保存到: ${historyFile}`));
  } catch (error) {
    console.log(colored.error(`保存聊天历史失败: ${error.message}`));
  }
}

// 交互式命令行界面
function startCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colored.agent('\n> ')
  });

  const showPrompt = () => {
    if (!state.isProcessing) {
      rl.prompt();
    }
  };

  eventEmitter.on('taskComplete', () => {
    showPrompt();
  });

  rl.on('line', async (line) => {
    const input = line.trim();

    if (input.toLowerCase() === 'exit') {
      saveChatHistory();
      rl.close();
      return;
    }

    if (input.toLowerCase() === 'status') {
      console.log(colored.info(`\n当前状态:
任务执行中: ${state.isProcessing ? '是' : '否'}
当前任务: ${state.currentTask || '无'}
当前步骤: ${state.currentStep}/${state.maxSteps}
工作目录: ${state.currentWorkingDir}
聊天历史长度: ${state.chatHistory.length}
操作历史条数: ${state.operationHistory.length}
当前temperature: ${state.temperatureControl.currentTemperature.toFixed(2)}
操作系统: ${platform.isAndroid ? 'Android' : 'Linux'}`));
      showPrompt();
      return;
    }

    if (input.toLowerCase() === 'help') {
      console.log(colored.info(`\n可用命令:
exit - 退出程序
status - 显示当前状态
help - 显示帮助信息
clear - 清除聊天历史
save - 保存聊天历史
其他输入将被视为任务指令`));
      showPrompt();
      return;
    }

    if (input.toLowerCase() === 'clear') {
      const systemPrompt = state.chatHistory[0];
      state.chatHistory = [systemPrompt];
      state.operationHistory = [];
      console.log(colored.info('聊天历史已清除'));
      showPrompt();
      return;
    }

    if (input.toLowerCase() === 'save') {
      saveChatHistory();
      showPrompt();
      return;
    }

    if (input && !state.isProcessing) {
      try {
        await processTask(input);
      } catch (error) {
        console.log(colored.error(`任务启动失败: ${error.message}`));
        showPrompt();
      }
    } else if (state.isProcessing) {
      console.log(colored.info('系统正在处理任务，请稍候...'));
    } else {
      showPrompt();
    }
  }).on('close', () => {
    console.log(colored.info('\n会话结束'));
    process.exit(0);
  });

  rl.on('SIGINT', () => {
    console.log(colored.info('\n接收到中断信号，正在保存聊天历史...'));
    saveChatHistory();
    console.log(colored.info('会话结束'));
    process.exit(0);
  });

  showPrompt();
}

// 启动系统
console.log(colored.info('\n智能代理系统已启动'));
console.log(colored.info(`版本: ${VERSION}`));
console.log(colored.info(`作者: ${AUTHOR}`));
console.log(colored.info(`当前工作目录: ${state.currentWorkingDir}`));
console.log(colored.info('输入 "exit" 退出, "status" 查看状态, "help" 获取帮助\n'));
startCLI();