// RotaLab: capacity-constrained insertion and local search.
// The same source builds as a freestanding WebAssembly module and a native CLI.
#ifdef ROTALAB_NATIVE
#include <stdio.h>
#endif

static const int N = 40, V = 5;
static double input[1024];
static int output[V * (N + 1)];
static int routes[V][N], counts[V], sorted[N];
static int n, m;
static double clock_now, traffic;

static double absolute(double x) { return x < 0 ? -x : x; }
static double* order(int i) { return input + 4 + i * 5; }
static double* vehicle(int v) { return input + 4 + n * 5 + v * 4; }
static double distance(double x, double y, double a, double b) {
    return (absolute(x - a) + absolute(y - b)) * .25;
}
static double load(int v) {
    double sum = 0; for(int k=0;k<counts[v];k++) sum += order(routes[v][k])[2]; return sum;
}
static double cost(int v) {
    double x=vehicle(v)[0], y=vehicle(v)[1], t=clock_now, km=0, late=0;
    for(int k=0;k<counts[v];k++) {
        double* o=order(routes[v][k]); double d=distance(x,y,o[0],o[1]);
        km+=d; t+=d/26*60*traffic+o[4];
        if(t>o[3]) late+=t-o[3]; x=o[0];y=o[1];
    }
    double back=distance(x,y,13,10); km+=back; t+=back/26*60*traffic;
    double duration=t-clock_now;
    return km*.6 + late*2.5 + duration*.03 + duration*duration*.002;
}
static void insert(int v,int p,int item) {
    for(int j=counts[v];j>p;j--) routes[v][j]=routes[v][j-1];
    routes[v][p]=item; counts[v]++;
}
static int remove_at(int v,int p) {
    int item=routes[v][p]; for(int j=p;j<counts[v]-1;j++) routes[v][j]=routes[v][j+1]; counts[v]--;return item;
}
static void reverse(int v,int a,int b) {
    while(a<b) {int temp=routes[v][a];routes[v][a]=routes[v][b];routes[v][b]=temp;a++;b--;}
}
extern "C" {
double* get_input_ptr() { return input; }
int* get_output_ptr() { return output; }
int optimize() {
    n=(int)input[0];m=(int)input[1];clock_now=input[2];traffic=input[3];
    if(n<0||n>N||m<1||m>V||traffic<=0) return -1;
    for(int v=0;v<m;v++) counts[v]=0;
    for(int i=0;i<n;i++) sorted[i]=i;
    for(int i=1;i<n;i++){int item=sorted[i],j=i-1;while(j>=0&&order(sorted[j])[3]>order(item)[3]){sorted[j+1]=sorted[j];j--;}sorted[j+1]=item;}
    int unassigned=0;
    for(int s=0;s<n;s++) {
        int item=sorted[s],bv=-1,bp=0;double best=1e100;
        for(int v=0;v<m;v++) {
            if(vehicle(v)[3]<.5||load(v)+order(item)[2]>vehicle(v)[2]+.0001)continue;
            double old=cost(v);
            for(int p=0;p<=counts[v];p++) {
                insert(v,p,item);double delta=cost(v)-old;remove_at(v,p);
                if(delta<best){best=delta;bv=v;bp=p;}
            }
        }
        if(bv>=0)insert(bv,bp,item);else unassigned++;
    }
    for(int pass=0;pass<4;pass++) {
        bool improved=false;
        for(int v=0;v<m;v++)for(int a=0;a<counts[v]-1;a++)for(int b=a+1;b<counts[v];b++){
            double old=cost(v);reverse(v,a,b);
            if(cost(v)<old-.00001)improved=true;else reverse(v,a,b);
        }
        if(!improved)break;
    }
    // Relocation between vehicles balances time windows while respecting capacity.
    for(int pass=0;pass<2;pass++)for(int a=0;a<m;a++)for(int k=0;k<counts[a];k++){
        int item=routes[a][k],bv=-1,bp=0;double improvement=0;
        double olda=cost(a);remove_at(a,k);double newa=cost(a);
        for(int b=0;b<m;b++)if(b!=a&&vehicle(b)[3]>.5&&load(b)+order(item)[2]<=vehicle(b)[2]+.0001){
            double oldb=cost(b);
            for(int p=0;p<=counts[b];p++){
                insert(b,p,item);double delta=newa+cost(b)-olda-oldb;remove_at(b,p);
                if(delta<improvement-.00001){improvement=delta;bv=b;bp=p;}
            }
        }
        if(bv>=0){insert(bv,bp,item);k--;}else insert(a,k,item);
    }
    for(int v=0;v<m;v++){
        output[v*(N+1)]=counts[v];
        for(int j=0;j<counts[v];j++)output[v*(N+1)+1+j]=routes[v][j];
    }
    return unassigned;
}
}

#ifdef ROTALAB_NATIVE
int main(){
    int total=0;while(total<1024&&scanf("%lf",&input[total])==1)total++;
    if(total<4)return 2;int result=optimize();if(result<0)return 3;
    printf("%d\n",result);
    for(int v=0;v<m;v++){printf("%d",counts[v]);for(int j=0;j<counts[v];j++)printf(" %d",routes[v][j]);printf("\n");}
    return 0;
}
#endif

