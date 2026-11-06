/* Fixture metrics listener. It does not open a tunnel. */
#include <arpa/inet.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static int metrics_port(int argc, char **argv) {
  int i;
  for (i = 1; i < argc - 1; i++) {
    if (strcmp(argv[i], "--metrics") == 0) {
      const char *s = strrchr(argv[i + 1], ':');
      if (s) return atoi(s + 1);
    }
    if (strcmp(argv[i], "wardos-hub") == 0) return -1;
  }
  return 0;
}

int main(int argc, char **argv) {
  int port = metrics_port(argc, argv);
  const char *fail;
  int s, opt = 1, c;
  struct sockaddr_in addr;
  const char *body = "{\"status\":200}\n";
  char hdr[160];
  char buf[1024];
  signal(SIGPIPE, SIG_IGN);
  if (port < 0) return 99;
  fail = getenv("WARDOS_FAKE_CF_FAIL_PORT");
  if (fail && port > 0 && atoi(fail) == port) return 1;
  if (port <= 0) return 2;
  s = socket(AF_INET, SOCK_STREAM, 0);
  if (s < 0) return 3;
  setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
  memset(&addr, 0, sizeof(addr));
  addr.sin_family = AF_INET;
  addr.sin_port = htons((unsigned short)port);
  inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);
  if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) < 0) return 4;
  if (listen(s, 16) < 0) return 5;
  fputs("boot token=SUPERSECRETTOKENVALUE1234567890?drop=1 id=12345678-1234-1234-1234-123456789abc via 203.0.113.10\n", stdout);
  fflush(stdout);
  for (;;) {
    c = accept(s, NULL, NULL);
    if (c < 0) continue;
    (void)read(c, buf, sizeof buf);
    snprintf(hdr, sizeof hdr, "HTTP/1.0 200 OK\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n", strlen(body));
    (void)write(c, hdr, strlen(hdr));
    (void)write(c, body, strlen(body));
    close(c);
  }
}
