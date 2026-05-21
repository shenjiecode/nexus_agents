# PicoClaw 接入第三方 API 代理（qnaigc）model 前缀被截断问题

## 问题

使用 qnaigc API 代理接入 `deepseek/deepseek-v4-flash` 模型时，PicoClaw 报 400 错误：

```
no available channels for model deepseek-v4-flash
```

API 实际需要 `deepseek/deepseek-v4-flash`（带 `deepseek/` 前缀），但 PicoClaw 发送的是 `deepseek-v4-flash`（前缀被去掉）。

## 根因

PicoClaw 的 OpenAI 兼容 provider 在构建请求体时调用 `normalizeModel()` 函数（`pkg/providers/openai_compat/provider.go:619`），该函数会：

1. 用 `/` 分割 model 字符串
2. 检查前缀是否在 `stripModelPrefixProviders` 列表中
3. 如果在列表中，**无条件去掉前缀**，只保留后半部分

`deepseek` 在 strip 列表中，所以 `deepseek/deepseek-v4-flash` → `deepseek-v4-flash`。

这个逻辑对 DeepSeek 官方 API 是正确的（官方 API 的 model 名不带前缀），但对 qnaigc 等第三方代理不适用——它们的 model 名需要保留完整的 `deepseek/` 前缀。

## 解决方案

利用 PicoClaw 的 `extra_body` 配置项覆盖请求体中的 `model` 字段。

`extra_body` 在 `buildRequestBody()` 中通过 `maps.Copy(requestBody, p.extraBody)` 合入，执行在 `normalizeModel()` 之后，因此可以覆盖被截断的 model 值。

### 配置示例

**config.json**：

```json
{
  "model_name": "qn-deepseek-v4-flash",
  "model": "deepseek-v4-flash",
  "provider": "openai",
  "api_base": "https://api.qnaigc.com/v1",
  "extra_body": { "model": "deepseek/deepseek-v4-flash" }
}
```

**.security.yml**：

```yaml
model_list:
  qn-deepseek-v4-flash:0:
    api_keys:
      - YOUR_API_KEY
```

### 关键点

- `model` 字段写不带前缀的名称（`deepseek-v4-flash`），避免 `normalizeModel` 二次截断
- `extra_body.model` 写 API 实际需要的完整名称（`deepseek/deepseek-v4-flash`），运行时覆盖请求体
- `model_name` 不要包含 `/`，否则 PicoClaw 会把 `/` 前部分当作 provider 前缀处理

## 涉及的源码路径（picoclaw）

| 文件 | 函数 | 作用 |
|------|------|------|
| `pkg/providers/openai_compat/provider.go:619` | `normalizeModel()` | 去掉已知 provider 前缀 |
| `pkg/providers/openai_compat/provider.go:50` | `stripModelPrefixProviders` | 会截断的 provider 前缀列表 |
| `pkg/providers/openai_compat/provider.go:194` | `maps.Copy(requestBody, p.extraBody)` | extra_body 覆盖请求体 |
| `pkg/providers/factory_provider.go:108` | `ExtractProtocol()` | 从 config 解析 provider 和 model |

## 其他尝试过的方案（均不可行）

| 方案 | 失败原因 |
|------|---------|
| `model: "deepseek/deepseek-v4-flash"` + `provider: "openai"` | `normalizeModel` strip `deepseek/` |
| `model: "openai/deepseek/deepseek-v4-flash"` | `ExtractProtocol` 取 `openai`，`normalizeModel` 再 strip `deepseek/` |
| `model: "openai/deepseek/deepseek-v4-flash"` 不设 provider | 同上 |
| `model_name` 含 `/`（如 `qn/xxx`） | PicoClaw 把 `/` 前缀当 provider，model 解析出错 |
