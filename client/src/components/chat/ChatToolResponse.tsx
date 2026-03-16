import { Component } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseJSON } from "@/lib/utils";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { ImageResponseData } from "@/store/slices/chatSessionSlice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChatToolResponseProps {
  open: boolean;
  onClose: () => void;
  tool: {
    tool: string;
    text: string;
    type: string;
    args: string;
    items?: ImageResponseData[];
  };
}

class ChatToolResponse extends Component<ChatToolResponseProps> {
  private getNormalizedResult() {
    if (this.props.tool.text) {
      if (
        this.props.tool.text[0] !== "{" &&
        this.props.tool.text[0] !== "["
      ) {
        return this.props.tool.text;
      }
      return parseJSON(this.props.tool.text);
    }
    if (this.props.tool.items) {
      return this.props.tool.items;
    }
    return "";
  }

  private renderStructuredCard(result: any) {
    const toolName = this.props.tool.tool;

    if (toolName === "health") {
      return (
        <Card className="py-4 gap-3">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-base">健康卡片</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 space-y-2 text-sm">
            <div>状态: {result?.status || result?.healthy || "unknown"}</div>
            <div>服务: {result?.service || result?.name || "N/A"}</div>
            <div>消息: {result?.message || "无"}</div>
          </CardContent>
        </Card>
      );
    }

    if (toolName === "security_policy") {
      return (
        <Card className="py-4 gap-3">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-base">安全策略卡片</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 space-y-2 text-sm">
            <div>白名单: {String(result?.whitelist_enabled ?? result?.whitelistEnabled ?? "unknown")}</div>
            <div>DELETE 禁用: {String(result?.delete_disabled ?? result?.deleteDisabled ?? "unknown")}</div>
            <div>默认知识库: {String(result?.default_knowledge_base_id ?? result?.defaultKnowledgeBaseId ?? "未设置")}</div>
            <div>允许路径模式: {JSON.stringify(result?.allowed_paths || result?.path_patterns || [], null, 2)}</div>
          </CardContent>
        </Card>
      );
    }

    if (toolName === "smoke_test") {
      const checks = result?.checks || result?.results || [];
      return (
        <Card className="py-4 gap-3">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-base">烟雾测试报告卡片</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 space-y-2 text-sm">
            <div>总结: {result?.summary || result?.message || "无"}</div>
            <div className="space-y-2">
              {Array.isArray(checks) && checks.length > 0 ? (
                checks.map((check: any, index: number) => (
                  <div key={index} className="rounded border p-2 flex items-center justify-between gap-2">
                    <span>{check.name || check.step || `check-${index + 1}`}</span>
                    <Badge variant={check.ok || check.success ? "default" : "destructive"}>
                      {check.ok || check.success ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">未返回详细检查项</div>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (toolName === "list_endpoints" || toolName === "list_allowed_endpoints") {
      const endpoints = result?.endpoints || result?.items || result || [];
      return (
        <Card className="py-4 gap-3">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-base">接口列表卡片</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 space-y-2 text-sm">
            {Array.isArray(endpoints) ? (
              endpoints.map((endpoint: any, index: number) => (
                <div key={index} className="rounded border p-2">
                  <div className="font-medium">{endpoint.path || endpoint.pattern || endpoint.url || `endpoint-${index + 1}`}</div>
                  <div className="text-muted-foreground">
                    {Array.isArray(endpoint.methods)
                      ? endpoint.methods.join(", ")
                      : endpoint.method || "methods unknown"}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">无结构化 endpoint 数据</div>
            )}
          </CardContent>
        </Card>
      );
    }

    if (toolName === "call_api" || toolName === "call_api_form") {
      return (
        <Card className="py-4 gap-3">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-base">通用 API 结果卡片</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 space-y-2 text-sm">
            <div>状态码: {result?.status || result?.status_code || "unknown"}</div>
            <div>消息: {result?.message || result?.detail || "无"}</div>
            {result?.data ? (
              <Textarea
                readOnly
                value={JSON.stringify(result.data, null, 2)}
                className="min-h-[240px]"
              />
            ) : null}
          </CardContent>
        </Card>
      );
    }

    return null;
  }

  render() {
    const result = this.getNormalizedResult();
    const prettyResult =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);
    const args = JSON.stringify(parseJSON(this.props.tool.args), null, 2);

    return (
      <Dialog
        open={true}
        onOpenChange={() => this.props.onClose()}
        modal={true}
      >
        <DialogContent className="sm:max-w-[80vw]">
          <DialogHeader>
            <DialogTitle>Tool Response</DialogTitle>
            <DialogDescription>{this.props.tool.tool}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]  w-full rounded-md p-0 pr-5 border-0 overflow-auto">
            <div className="space-y-4">
              {typeof result === "object" && result
                ? this.renderStructuredCard(result)
                : null}
              <Card className="py-4 gap-3">
                <CardHeader className="px-4 pb-0">
                  <CardTitle className="text-base">原始参数与结果</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pt-0 space-y-3">
                  <div>
                    <div className="font-medium mb-2">Arguments</div>
                    <Textarea value={args} readOnly className="min-h-[160px]" />
                  </div>
                  <div>
                    <div className="font-medium mb-2">Result</div>
                    <Textarea
                      value={prettyResult}
                      readOnly
                      className="min-h-[260px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

export default ChatToolResponse;
