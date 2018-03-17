(function(){
    var _html = [
        '<div class="logobox" id="logobox" attr="logobox">',
            '<img src="./images/logo.png" alt="">',
            '<h4>登录</h4>',
            '<input class="username" type="text" placeholder="账号">',
            '<input class="password" type="password" placeholder="密码">',
            '<div class="select">',
                '<input type="checkbox" name="" id="pas"><span class="jzpaword">记住密码</span><span class="uppassworld">修改密码</span>',
            '</div>',
            '<button id="loginbtn" attr="click:login">登录</button>',
        '</div>'
    ].join("");
    var init = function(parent, data, config) {
        this.data = data;
        this.config = config;
        this.appendHTML(_html, parent);
        this.hide = function(){
             $(this.node.logobox).hide();
        }
    };
    var evLogin = function(){
        //debugger;
        hide.call(this);
    };
    var hide = function(){
         $(this.node.logobox).hide();
    };
    $we.widget.reg("pic.login", {
        init: init,
        interfaces: {},
        events: {
            login:evLogin
        },
        notifies: {
            hide:hide
        }
    });
})();