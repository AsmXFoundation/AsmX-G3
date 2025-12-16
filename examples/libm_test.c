#include <stdio.h>

extern long add(long a, long b);
extern long sub(long a, long b);
extern void lc_print();

int main() {
  long a = 100;
  long b = 20;

  printf("Loading functions from libmath.so...\n");
  printf("Arguments: a = %ld, b = %ld\n\n", a, b);

  long res_add = add(a, b);
  long res_sub = sub(a, b);

  printf("add(a, b) result: %ld  (expected 120)\n", res_add);
  printf("sub(a, b) result: %ld   (expected 80)\n", res_sub);

  if (res_add == 120 && res_sub == 80) {
    printf("\n[SUCCESS] Integration with C works perfectly!\n");
  } else {
    printf("\n[FAIL] Math results are incorrect.\n");
  }

  lc_print();
  return 0;
}
