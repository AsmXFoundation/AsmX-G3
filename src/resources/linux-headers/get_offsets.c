#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/kobject.h>
#include <linux/refcount.h>
#include <linux/moduleparam.h>  
#include <linux/stddef.h> 
#include <linux/utsname.h> 
#include <linux/version.h> 
#include <generated/utsrelease.h> /* Required for UTS_RELEASE */

MODULE_LICENSE("GPL");
MODULE_AUTHOR("AsmX Tools");
MODULE_DESCRIPTION("A module to print struct module offsets and size.");

static int __init get_offsets_init(void)
{
    pr_info("ASMX_METADATA:structSize=%zu\n", sizeof(struct module));
    pr_info("ASMX_METADATA:nameOffset=%zu\n", offsetof(struct module, name));
    pr_info("ASMX_METADATA:initOffset=%zu\n", offsetof(struct module, init));
    pr_info("ASMX_METADATA:exitOffset=%zu\n", offsetof(struct module, exit));
    pr_info("ASMX_METADATA:moduleNameLen=%zu\n", (size_t)MODULE_NAME_LEN);
    pr_info("ASMX_METADATA:stateOffset=%zu\n", offsetof(struct module, state));

#ifdef CONFIG_MODULE_UNLOAD
    pr_info("ASMX_METADATA:refcntOffset=%zu\n", offsetof(struct module, refcnt));
#else
    pr_info("ASMX_METADATA:refcntOffset=-1\n");
#endif

    // We return -1 so that the module is not loaded into the kernel, but has time to write to the log.
    return -1; 
}

static void __exit get_offsets_exit(void){}

module_init(get_offsets_init);
module_exit(get_offsets_exit);
