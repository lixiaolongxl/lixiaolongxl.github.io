/**
 * 版权归蓝鲸作者所有 xuyuanfei@live.com
 */

/**  NO.1
 * Widget 组建的初始化的格式
 * @els 指定了从什么地方可以获取组建唯一的来源， 建议使用id
 * @attr 指定了组件对应的属性， 可以通过this.attr("key")来获取
 * @widget 指定组件的方法以及关联方式的组件来源
 * @tag 主要指定了寻找组件的时候的方式
 widgetConbind = {
	els : {											组件内元素结构，会被bindEvent调用
		left : ["id1", "id2"],
		right : ["id3"]
	},
	event : [{id : id, evt : key, val : val}],		组件内部事件机制，会被bindEvent调用
	trigger : [{id : id, evt : key, val : val}],	组件外部事件机制，会被bindEvent调用
	attr : {"background":"red"},					组件的属性值
	widget : ["layout", "picslide"],				组件将继承的对象
	tag : {category:"test",name:"test"},			用于组件定位， 方便统一查找
	param : []										初始化的时候使用的参数
 }
 */

/**  NO.2
 * widget 组件配置的参数格式
 * @els 指定了从什么地方可以获取组建唯一的来源， 建议使用id
 * @attr 指定了组件对应的属性， 可以通过this.attr("key")来获取
 * @widget 指定组件的方法以及关联方式的组件来源
 * @tag 主要指定了寻找组件的时候的方式
 widget = {
	module : "path/id",								模板来源可能是页面的id也可能是可以请求的path
	prepare : [{url,type,data,ready,saveto}],		和Ajax调用参数一致， 不同的是， saveto保存了请求回来的参数， ready是回调执行的函数，使用regAction注册
	attr : {"background":"red"},					原封不动传给NO.1
	tag : {category:"test",name:"test"},			原封不动传给NO.1
	ready : function / function name				组件初始化完成后调用，可以传递函数，也可以传一个regAction中定义的name
 }
 */

/**  NO.3
 * 注册组件的时候， 组件的结构
 * 也就是使用$we.widget.reg调用注册组件的时候的推荐结构
 struct = {
	interfaces : {},								该模版定义的各类接口
	notifies : {},									被调用节点往父节点通知对应的结构
	events : {},									定义了组件内元素联动的方式
	bind,											在组件内元素联动是调用
	init											组件都初始化完成后的操作
 }
 */

;(function(){
	var widgetsConfig = {},
		widgets = [],
		toInitWidgets = [],
		widgetActions = {},
		widgetTpl = {},
		widgetTplPedding = {};
		 _maxId = +new Date,
		_markComplate = {},
		tmpDiv = document.createElement("div");
	
	/**
	 * 调试信息展示
	 */
	var DebugInfo = function(str, status){
		// console.log(str);
	};
	
	DebugInfo.Error = 1;
	
	/**
	 * 所有剩余组件的一次初始化
	 */
	var initWidgets = function(){
		while(toInitWidgets.length > 0){
			var item = toInitWidgets.shift();
			item.sender.init(item.param);
		}
	};

	/**
	 * 组件初始化过程
	 * @config 组件初始化的结构，如NO.1中的说明
	 * @parent 组件初始化的时候对应的父组件，暂时用不到， 以后可能会用到
	 * @bComplate 组件是否达到直接初始化的状态
	 */
	var Widget = function(config, parent, bComplate){
		widgets.push(this);
		
		// 准备一下使用的变量
		this._config = config;
		this._status = Widget.NOT_START;
		this._interfaces = {};
		this._notifies = {};
		this._events = {};
		this._bindCb = [];
		this._initCb = [];
		this._data = {};
		this.node = {};
		this.nodes = {};
		
		// 设置一下父元素
		if(parent){
			this.setNotifyTo(parent);
		}
		
		// 继承元素
		for(var i=0,len=config.widget && config.widget.length || 0;i<len;++i){
			this.extent(config.widget[i], config.param || []);
		}
		
		this.bindEvent(config);
		this.bind();
		
		// 如果全部结束了， 那么可以考虑全部都处理掉
		if(bComplate){
			this.init(config.param || []);
		}else{
			toInitWidgets.push({
				sender : this,
				param : config.param || []
			});
		}
	};
	
	Widget.status = {
		NOT_START : 0,
		RENDER_READY : 1,
		INIT_READY : 2
	};
	
	/**
	 * 产生外部事件的调用
	 * @self 产生这个事件的对象
	 * @evtName 产生事件的名称， 是使用regAction注册的事件
	 * @el 产生事件对应的DOM元素
	 */
	var createTriggerCb = function(self, evtName, el){
		return function(e){
			self.trigger(e, evtName, el);
		};
	};
	
	/**
	 * 产生外部事件的调用
	 * @self 产生这个事件的对象
	 * @cb 回调函数对象
	 * @el 产生事件对应的DOM元素
	 */
	var createEvtCb = function(self, cb, el){
		return function(e){
			cb.call(self, e, el);
		};
	};
	
	/**
	 * 为对象绑定一些属性
	 * @config 处理的领域， 包括了els, event, trigger这三种配置
	 */
	Widget.prototype.bindEvent = function(config){
		// 设置元素， 
		var els = config.els;
		for(var name in els){
			this.nodes[name] = this.nodes[name] || [];
			for(var i=0;i<els[name].length;++i){
				var el = eid(els[name][i]);
				this.node[name] = el;
				this.nodes[name].push(el);
			}
		}
		// 处理内部事件
		var els = config.event;
		for(var i=0;els && i<els.length;++i){
			var tmp = els[i];
			if(!this._events[tmp.val]){
				$we.Exception("Event[" + tmp.val + "] is not Registered");
				continue;
			}
			$(eid(tmp.id)).on(tmp.evt, createEvtCb(this, this._events[tmp.val], eid(tmp.id)));
		}
		// 处理外部事件
		var els = config.trigger;
		for(var i=0;els && i<els.length;++i){
			var tmp = els[i];
			$(eid(tmp.id)).on(tmp.evt, createTriggerCb(this, tmp.val, eid(tmp.id)));
		}
	};
	
	/**
	 * 通过ID或者DOM返回对应的DOM对象
	 * @el DOM元素或者DOM元素对应的ID
	 */
	var eid = function(el){
		if(typeof el == "string"){
			return document.getElementById(el);
		}
		return el;
	};
	
	/**
	 * 通过设置的name进行查询
	 * 找到某个name以下所有的第一级孩子
	 * 找到某个name下所有的孩子
	 * 找到某个name下第一级孩子的第一个
	 * 找到某个name下第一级孩子中的最后一个
	 * 找到含有某个函数的孩子
	 */
	Widget.prototype.checkCondition = function(cond){
		if(typeof cond == "string"){
			cond = {name : cond};
		}
		var tag = this._config.tag || {},
			ret = false;
		for(var name in cond){
			if(cond[name] != tag[name]){
				return false;
			}
			ret = true;
		}
		return ret;
	};
	
	/**
	 * 为组件实例设置变量
	 * @key 组件变量的名称
	 * @val 组件变量的值
	 */
	Widget.prototype.set = function(key,val){
		if(!key){
			return;
		}
		this._data[key] = val;
	};
	
	/**
	 * 从组件变量中获取变量设置
	 * @key 组件变量的名称
	 */
	Widget.prototype.get = function(key){
		return this._data[key];
	};
	
	/**
	 * 设置组件之间的汇报对象
	 * @obj 设置该组件将会汇报的对象
	 */
	Widget.prototype.setNotifyTo = function(obj) {
		if (!obj._notifyMembers) obj._notifyMembers = [];
		obj._notifyMembers.push(this);
		this._notifyTo = obj;
		return this;
	};
	
	
	/**
	 * 向汇报对象汇报一些重要情报
	 * @type 汇报事件发生的时候指定相应的函数
	 * 从第二个参数开始往后， 都将作为参数传给第一个对象
	 */
	Widget.prototype.notify = function(type) {
		var param = [];
		for (var i = 1; i < arguments.length; ++i) {
			param.push(arguments[i]);
		}
		var notifyTo = this._notifyTo;
		while (notifyTo) {
			if (notifyTo._notifies && typeof notifyTo._notifies[type] == "function") {
				return notifyTo._notifies[type].apply(notifyTo, param);
			}
			notifyTo = notifyTo._notifyTo;
		}
	};
	
	/**
	 * 从组件传进来的属性中获取值
	 * @key 组件属性的名称
	 */
	Widget.prototype.attr = function(key){
		return this._config && this._config.attr && this._config.attr[key];
	};
	
	/**
	 * 触发某个使用regAction定义的动作
	 * @e 事件对象
	 * @evtName 会被触发的事件名称
	 * @el 触发事件的元素
	 */
	Widget.prototype.trigger = function(e, evtName, el){
		if(widgetActions[evtName]){
			widgetActions[evtName].call(this, e, el);
		}else{
			DebugInfo(evtName + " is not registered");
		}
	};
	
	/**
	 * 外部程序调用组件中定义的interfaces中的接口
	 * @func 接口名称
	 * @param 事件调用的时候传入的参数，以数组方式传入
	 */
	Widget.prototype.exec = function(func, param){
		if(!this._interfaces[func]){
			return;
		}
		return this._interfaces[func].apply(this, param || []);
	};
	
	var _createCb = function(self, cb){
		return function(){
			return cb.apply(self, arguments);
		};
	};
	
	/**
	 * 动态扩展注册的组件到某个实例中
	 * @name 组件的名称
	 * widgetsConfig中的结构， 如No.3中所示
	 */
	Widget.prototype.extend = Widget.prototype.extent = function(name, param){
		var widgetConfig = widgetsConfig[name];
		if(widgetConfig){
			for(var name in (widgetConfig && widgetConfig["interfaces"])){
				this._interfaces[name] = widgetConfig["interfaces"][name];
				this[name] = _createCb(this, widgetConfig["interfaces"][name]);
			}
			for(var name in (widgetConfig && widgetConfig["notifies"])){
				this._notifies[name] = widgetConfig["notifies"][name];
			}
			for(var name in (widgetConfig && widgetConfig["events"])){
				this._events[name] = widgetConfig["events"][name];
			}
			
			// 把事件都压入配置
			widgetConfig["bind"] && this._bindCb.push(widgetConfig["bind"]);
			widgetConfig["init"] && this._initCb.push(widgetConfig["init"]);
			
			if(this._status != Widget.NOT_START){
				this.bind();
			}
			if(this._status == Widget.INIT_READY){
				this.init(param);
			}
		}
	};
	
	/**
	 * 组件中所有的bind事件都执行一次， 主要是为了绑定元素的关联关系
	 */
	Widget.prototype.bind = function(){
		if(this._status == Widget.NOT_START){
			this._status = Widget.RENDER_READY;
		}
		while(this._bindCb.length > 0){
			this._bindCb.shift().call(this);
		}
	};
	
	/**
	 * 组件中所有的init事件都执行一次， 主要是为了初始化组件
	 */
	Widget.prototype.init = function(param){
		if(this._status != Widget.INIT_READY){
			this._status = Widget.INIT_READY;
		}
		while(this._initCb.length > 0){
			this._initCb.shift().apply(this, param);
		}
	};
	
	/**
	 * 使用一组配置把本组件给替换掉
	 * @config 可以是一个组件的配置， 也可以是一堆组件的配置
	 * 值得注意的是， 被替换的组件必须有root节点， 否则无法把自己给remove掉
	 */
	Widget.prototype.replace = function(config){
		// 把自己用别的给替换掉
		var div = document.body.appendChild(document.createElement("div")),
			me = this;
		div.style.cssText = "display:none";
		this._config.markDelete = true;
		$we(config, null, this, div, function(){
			if(!me.node.root){
				DebugInfo("no root element defined when trying to call replace");
				DebugInfo(config);
				return;
			}
			while(div.childNodes.length != 0){
				me.node.root.parentNode.insertBefore(div.childNodes[0], me.node.root);
			}
			me.node.root.parentNode.removeChild(me.node.root);
			document.body.removeChild(div);
		});
	};
	
	Widget.prototype.appendHTML = function(str, parent, data){
		var html = str.replace(/\$(\w+)\$/g, function(a, b){
			try{
				return typeof data[b] != "undefined" ? data[b] : a;
			}catch(e){
				return a;
			}
		});
		var div = document.body.appendChild(document.createElement("div")),
			config = {
				event : [],
				trigger : [],
				els : {}
			},
			els = config.els,
			evt = config.event;
		$(div).append(html);
		var attrs = $(div).find("[attr]").toArray();
		for(var i=0;attrs && i<attrs.length;++i){
			var text = $(attrs[i]).attr("attr");
			if(text && typeof text == "string"){
				var arr = text.split(";"),
					el = attrs[i];
				for(j=0;j<arr.length;++j){
					var t = arr[j].split(":");
					if(1 == t.length && t[0]){
						els[t[0]] = els[t[0]] || [];
						els[t[0]].push(el);
					}else if(2 == t.length){
						if("inner" == t[0]){
							els[t[1]] = els[t[1]] || [];
							els[t[1]].push(el);
						}else{
							evt.push({
								id : el,
								evt : t[0],
								val : t[1]
							});
						}
					}
				}
			}
		}
		this.bindEvent(config);
		while(div.firstChild){
			parent.appendChild(div.firstChild);
		}
		document.body.removeChild(div);
	};
	
	Widget.prototype.appendTpl = function(str, data){
		
	};
	
	/**
	 * 类：客户端组件的类
	 * @config 组件的结构 结构如NO.2指示
	 * @el 组件渲染的时候依附的跟节点
	 * @parent 组件创建的时候设置调用他的组建， 就是父组件； 现在没有在用，以后可能会用
	 * @cb 组件渲染玩之后的回调时间
	 */
	var renderNext = function(config, el, parent, cb){
		// 判断该条记录是否需要忽略
		var ignore = $we.data(config, "ignore") && $we.val($we.data(config, "ignore")) || false;
		if(ignore){
			// 如果ignore返回为true， 就不要执行了
			cb && cb();
			return;
		}
		
		// 这边杜绝了引用拷贝， 必须值拷贝
		config = eval("(" + JSON.stringify(config || {}) + ")");
		// sockets将会用来做递归调用塞widget和DOM元素使用
		config.sockets = [];
		
		// 开始分析模板
		if(widgetTpl[config.module]){
			// 模板本来就存在， 直接渲染
			moduleReady(widgetTpl[config.module], config, el, parent, cb);
		}else{
			if(document.getElementById(config.module) && document.getElementById(config.module).innerHTML){
				// 模板可以通过元素的innerHTML来获取， 也可以直接渲染
				widgetTpl[config.module] = document.getElementById(config.module).innerHTML;
				moduleReady(widgetTpl[config.module], config, el, parent, cb);
			}else{
				// 需要请求服务器才能获取模板
				// 先压入等待队列
				if(widgetTplPedding[config.module]){
					widgetTplPedding[config.module].push({
						config: config,
						parent : parent,
						el : el,
						cb : cb
					});
					return;
				}
				widgetTplPedding[config.module] = [{
					parent : parent,
					config: config,
					el : el,
					cb : cb
				}];
				// 开始请求这样的数据
				$.ajax({
					url : config.module,
					dataType : "text",
					data: {
						t : ($we.tplVersion || (+new Date))
					},
					success : function(html){
						widgetTpl[config.module] = html;
						var arr = widgetTplPedding[config.module];
						while(arr.length > 0){
							// 模板请求好了， 挨个进行模板的拼接工作
							var tmp = arr.shift();
							moduleReady(html, tmp.config, tmp.el, tmp.parent, tmp.cb);
						}
					},
					error: function(){
						// 出错了
						DebugInfo("module [" + config.module + "] is not prepared", DebugInfo.Error);
					}
				});
			}
		}
	};
	
	/**
	 * 模板准备好了， 需要处理一下prepare中指定的请求
	 * @html 模板文件字符串
	 * @config 渲染模板可能需要的配置文件
	 * @el 组建渲染后需要附着在什么样的模板上
	 * @parent 组件创建的时候设置调用他的组建， 就是父组件； 现在没有在用，以后可能会用
	 * @cb 渲染完成后， 会产生的回调事件
	 */
	var moduleReady = function(html, config, el, parent, cb){
		if(config.prepare){
			// 把需要填充的数据丢到config.req下面
			config.req = config.req || {};
			if(!$we.isArray(config.prepare)){
				config.prepare = [config.prepare];
			}
			var next = function(){
				if(config.prepare.length > 0){
					var tmp = config.prepare.shift(),
						arr = (tmp.ignore||"").split(","),
						req = {
							data : {},
							dataType : "text",
							url : tmp.url,
							type : tmp.type
						};
					for(var i=0;i<arr.length;++i){
						if(arr[i] && $we.val(arr[i])){
							// 已经有值了
							next();
							return;
						}
					}
					arr = (tmp.condition||"").split(",");
					for(var i=0;i<arr.length;++i){
						if(arr[i] && !$we.val(arr[i])){
							// 需要准备的没有准备好
							next();
							return;
						}
					}
					for(name in tmp.data){
						req.data[name] = $we.val(tmp.data[name]);
					}
					req.success = function(str){
						var data = eval("(" + str + ")");
						if(tmp.saveto){
							$we.set(tmp.saveto, data);
						}
						if(tmp.res){
							config.req[tmp.res] = data;
						}
						//
						if(tmp.ready && widgetActions[tmp.ready]){
							widgetActions[tmp.ready](function(bCancel){
								if(bCancel === true){
									// 结束了， 啥也不用做了
								}else{
									next();
								}
							}, tmp);
						}else{
							next();
						}
					};
					req.error = $we.errHandle || function(){};
					$.ajax(req);
				}else{
					// 所有的需要事先请求的数据都请求完成了
					// 开始渲染模板
					renderView(html, config, el, parent, cb);
				}
			}
			next();
		}else{
			// 没有任何需要准备的
			// 直接渲染模板
			renderView(html, config, el, parent, cb);
		}
	};
	
	/**
	 * 渲染数据都准备好了， 根据模板开始渲染
	 * @html 模板文件字符串
	 * @config 渲染模板可能需要的配置文件
	 * @parent 组建渲染后需要附着在什么样的模板上
	 * @cb 渲染完成后， 会产生的回调事件
	 */
	var renderView = function(html, config, el, parent, cb){
		var html = $we.template(html, config),
			widgets = [],
			idMap = {},
			events = [];
			
		// 解析HTML加载node
		// HTML中如果需要添加node 格式是__node__ 替换成为id的方式
		html = html.replace(/__(\w+)__/g, function(a, b, c){
			var id = "i" + (++_maxId);
			idMap[b] = idMap[b] || [];
			idMap[b].push(id);
			return 'id="' + id + '"';
		});
		
		// 解析HTML加载可能需要的widget
		html = html.replace(/__\[([\w\,\s]+)\]__/g, function(a, b, c){
			var id = "i" + (++_maxId),
				arr = b.split(",");
			idMap["root"] = idMap["root"] || [];
			idMap["root"].push(id);
			for(var i=0;i<arr.length;++i){
				var w = arr[i].replace(/^\s+|\s+$/g, "");
				if(w){
					widgets.push(w);
				}
			}
			return 'id="' + id + '"';
		});
		
		// 解析HTML绑定事件
		// 为了让事件支持多语言
		html = html.replace(/__\{([^\{\}\_]+)\}__/g, function(a, b, c){
		//html = html.replace(/__\{(.+)\}__/g, function(a, b, c){
			var id = "i" + (++_maxId),
				arr = b.split(",");
			for(var i=0;i<arr.length;++i){
				var map = arr[i].split(":");
				if(map.length == 2){
					var key = map[0].replace(/^\s+|\s+$/g, ""),
						val = map[1].replace(/^\s+|\s+$/g, "");
					if(key && val){
						if(key == "node"){
							idMap[val] = idMap[val] || [];
							idMap[val].push(id);
						}else{
							events.push({
								id : id,
								evt : key,
								val : val
							});
						}
					}
				}
				var w = arr[i].replace(/^\s+|\s+$/g, "");
				if(w){
					widgets.push(w);
				}
			}
			return 'id="' + id + '"';
		});
		
		// HTML计算完毕， 需要把HTML加载到页面中去
		tmpDiv.innerHTML = html;
		while(tmpDiv.firstChild){
			el.appendChild(tmpDiv.firstChild);
		}
		
		// 创建这样的组件
		var widget = new Widget({
			els : idMap,
			event : events,
			attr : config.attr,
			widget : widgets,
			tag : config.tag
		}, parent);
		
		// 不管使用哪种脚本， 都需要把需要下一步执行的内容放到config.sockets对象中
		// config.sockets的结构如下 {el, config};
		config.sockets = config.sockets || [];
		for(var i=0;i<config.sockets.length;++i){
			if(typeof config.sockets[i].el == "string"){
				config.sockets[i].el = widget.node[config.sockets[i].el];
			}
		}
		cb(config.sockets, widget);
	};

	
	/**
	 * 使用层次遍历逐个加载模块
	 * @struct 组件属性， 调用关系等
	 * @actions 各种待注入系统的事件配置
	 * @parent 组件生成后的父对象， 目前可能没有用
	 * @root 组件生成后的父DOM节点
	 * @cb 所有组件初始化完成后的回调函数
	 */
	$we = function(struct, actions, parent, root, cb){
		// 注册页面可能需要的回调时间
		$we.regAction(actions);
		
		var queue = [];
		// 结构先压入队列
		if(Object.prototype.toString.call(struct) != "[object Array]"){
			queue.push({
				el : root || document.body,
				config : struct,
				parent : parent || null
			});
		}else{
			for(var i=0;i<struct.length;++i){
				queue.push({
					el : root || document.body,
					config : struct[i],
					parent : parent || null
				});
			}
		}
		
		// 处理每次的记录， 层次遍历
		var goonwithnextwidget = function(){
			if(queue.length == 0){
				// 都执行完成后，可以有一个大的回调
				initWidgets();
				cb && cb();
				return;
			}
			var item = queue.shift();
			renderNext(item.config, item.el, item.parent, function(arr, p){
				for(var i=0;i<arr.length;++i){
					queue.push({
						el : arr[i].el,
						config : arr[i].config,
						parent : p
					});
				}
				goonwithnextwidget();
			});
		};
		goonwithnextwidget();
	};
	
	var WeType = function(){};
	
	$we.t = {
		"typ" : new WeType(),
		"str" : new WeType(),
		"arr" : new WeType(),
		"obj" : new WeType(),
		"bol" : new WeType(),
		"num" : new WeType(),
		"dom" : new WeType(),
		"win" : new WeType(),
		"fun" : new WeType(),
		"nul" : new WeType()
	};
	
	// 标记一下浏览器以及对应的版本
	var userAgent = navigator.userAgent;
	$we.browser = {
		version : (userAgent.match( /(?:rv|it|ra|ie)[\/: ]([\d.]+)/ ) || [])[1], //(userAgent.match( /.+(?:rv|it|ra|ie)[\/: ]([\d.]+)/ ) || [])[1],
		webkit : /webkit/.test( userAgent ),
		chrome : /chrome/.test( userAgent ),
		opera : /opera/.test( userAgent ),
		ie : /msie/.test( userAgent ) && !/opera/.test( userAgent ),
		mozilla : /mozilla/.test( userAgent ) && !/(compatible|webkit)/.test( userAgent ),
		firefox : /firefox\/(\d+\.\d)/i.test(userAgent)
	};
	
	/**
	 * 计算一个变量的类型
	 * @v 变量
	 */
	$we.type = function(v){
		var type = Object.prototype.toString.apply(v).toLowerCase();
		if(type.indexOf("html") != -1 
			|| (v && v.nodeType && v.tagName)
			|| (v && v.nodeName)
			|| (v && v.nodeType && v.nodeValue)
			|| (v == window)){
			return $we.t.dom;
		}
		if(typeof v == "function"){
			return $we.t.fun;
		}
		if(v === null || v === undefined){
			return $we.t.nul;
		}
		switch(Object.prototype.toString.apply(v).toLowerCase()){
			case "[object string]":
				return $we.t.str;
			case "[object array]":
				return $we.t.arr;
			case "[object object]":
				return $we.t.obj;
			case "[object boolean]":
				return $we.t.bol;
			case "[object number]":
				return $we.t.num;
			default:
				return $we.t.win;
		}
	};
	
	/**
	 * 判断是否是数组
	 * @obj 判断需要传入的对象
	 */
	$we.isArray = function(obj){
		return Object.prototype.toString.call(obj) == "[object Array]";
	};
	
	/**
	 * 注册事件到系统
	 * @name 事件的名称
	 * @func 事件对应的函数调用
	 */
	$we.regAction = function(name, func){
		if(typeof name == "string"){
			widgetActions[name] = func;
		}else{
			for(n in name){
				widgetActions[n] = name[n];
			}
		}
	};
	
	/**
	 * 触发注册进去的系统事件， 建议别用
	 * @name 需要触发的系统事件的名称
	 * @param 触发事件的时候需要带的参数， 数组的格式
	 */
	$we.triggerAction = function(name, param){
		if(widgetActions[name]){
			widgetActions[name].apply(this, param || []);
		}
	};
	
	/**
	 * 按照给的条件找到合适的组件
	 * @cond 查询条件， 是按照条件尽心并操作查找
	 */
	$we.find = function(cond){
		var ret = [];
		for(var i=0;i<widgets.length;++i){
			if(widgets[i].checkCondition(cond) && !widgets[i]._config.markDelete){
				ret.push(widgets[i]);
			}
		}
		return ret;
	};
	
	/**
	 * 按照给的条件删除对应的组件
	 * @cond 查询条件， 是按照条件尽心并操作查找
	 */
	$we.markDelete = function(cond){
		for(var i=0;i<widgets.length;++i){
			if(widgets[i].checkCondition(cond)){
				widgets[i]._config.markDelete = true;
			}
		}
	};
	
	/**
	 * 按照给的条件找到对应的组件并且让他们执行对应的事件
	 * @cond 查询条件， 是按照条件尽心并操作查找
	 * @func 执行的函数名称， 这个函数名称必须在所查找的元素的interfaces中也有
	 * @arguments 传入的参数， 从第三个参数开始算起
	 * 返回的结果是个数组， 找到所有的执行组件和对应的结果 {sender, value}
	 */
	$we.exec = function(cond, func){
		cond = cond || {};
		var widgets = $we.find(cond),
			ret = [];
		if(widgets.length){
			var param = [];
			for(var i=2;i<arguments.length;++i){
				param.push(arguments[i]);
			}
			for(var i=0;i<widgets.length;++i){
				ret.push({
					sender : widgets[i],
					value : widgets[i].exec(func, param)
				});
			}
		}
		return ret;
	};
	
	/**
	 * 按照给的条件找到对应的组件并且让他们执行对应的事件
	 * @cond 查询条件， 是按照条件尽心并操作查找
	 * @func 执行的函数名称， 这个函数名称必须在所查找的元素的interfaces中也有
	 * @arguments 传入的参数， 从第三个参数开始算起
	 * 返回的结果是个数组， 找到所有的执行组件和对应的结果 {sender, value}
	 */
	$we.getValue = function(cond){
		var ret = {},
			tmp = $we.exec(cond, "getValue");
		for(var i=0;i<tmp.length;++i){
			if(tmp[i].sender._config 
				&& tmp[i].sender._config.tag 
				&& tmp[i].sender._config.tag.name){
				ret[tmp[i].sender._config.tag.name] = tmp[i].value;
			}
		}
		return ret;
	};
	
	/**
	 * 获取绑定到元素的值
	 * @el 绑定的元素
	 * @name 绑定元素的值， 默认使用whale-data属性
	 */
	$we.getBindValue = function(el, name){
		name = name || "whale-data";
		name = $(el).attr(name);
		return $we.get(name);
	};
	
	/**
	 * 设置绑定到元素的值
	 * @el 绑定的元素
	 * @value 绑定的值
	 * @name 绑定元素的值， 默认使用whale-data属性
	 */
	$we.setBindValue = function(el, value, name){
		var val = "name" + (++_maxId);
		$we.set(val, value);
		name = name || "whale-data";
		$(el).attr(name, val);
	};
	
	/**
	 * 为了产生全局唯一的ID
	 */
	$we.getUniqueId = function(){
		return ++_maxId;
	};
	
	/**
	 * 出错信息展示
	 * @str 出错信息字符串
	 */
	$we.Exception = function(str){
		DebugInfo(str, DebugInfo.error);
	};
	
	/**
	 * 页面加载后的第一次初始化, 根据页面中的ID和相关的配置， 重新还原当初的组建结构
	 * @arr 页面中元素结构的数组， 数组元素满足NO.1的说明
	 */
	$we.widget = function(arr){
		if(!$we.isArray(arr)){
			arr = [arr];
		}
		for(var i=0;i<arr.length;++i){
			var item = arr[i];
			new Widget(item, null, true);
		}
	};
	
	/**
	 * 为每一个组件增加统一的事件
	 * @name 事件名称
	 * @func 事件对应的执行代码
	 */
	$we.widget.addWidgetFunc = function(name, func) {
		Widget.prototype[name] = func;
	};
	
	/**
	 * 注册组件配置到系统
	 * @name 组件的名称
	 * @config 组件的配置
	 */
	$we.widget.reg = function(name, config){
		widgetsConfig[name] = config;
	};

	/**
	 * 添加一个组件
	 * @param 组件参数
	 * 从第二个参数开始，都将作为初始化函数传入
	 */
	$we.widget.add = function(param) {
		if (typeof param == "string") {
			param = {
				name: param
			};
		}
		var params = [];
		for (var i = 1; i < arguments.length; ++i) {
			params.push(arguments[i]);
		}
		return new Widget({
			widget : [param.name],
			param : params
		}, param.notifyTo, true);
	};
})();

(function($we){
	$we.arr = $we.arr || {};
	
	$we.arr.each = function (arr, func, scope){
		if($we.type(arr) != $we.t.arr){
			return;
		}
		scope = scope || window;
		for(var i=0; i < arr.length; ++i){
			var b = func.call(scope, arr[i], i);
			if(b === false){
				break;
			}
		}
	};
	
	$we.arr.remove = function (arr, arg){
		var func = null, ret = [];
		if($we.type(arg) == $we.t.fun){
			func = arg;
		}else{
			func = function(item){
				return arg == item;
			}
		}
		$we.arr.each(arr, function(item){
			if(!func(item)){
				ret.push(item);
			}
		});
		return ret;
	};
	
	$we.arr.isIn = function (arr, item){
		return $we.arr.indexOf(arr, item) != -1;
	};
	
	$we.arr.indexOf = function (arr, item, from) {
		if($we.type(arr) != $we.t.arr){
			return -1;
		}
		var len = arr.length;
		from = from | 0;
		if(from < 0) from += len; 
		if(from < 0) from = 0;

		for(; from<len; from++) {
			if(typeof item == "function"){
				if(item(arr[from])){
					return from;
				}
			}else{
				if(from in arr && arr[from]===item) 
					return from;
			}
		}
		return -1;
	};
	
	$we.arr.copy = function(arr){
		var ret = [];
		for(var i=0;i<arr.length;++i){
			ret.push(arr[i]);
		}
		return ret;
	};
})($we);(function($we){
	$we.files = $we.files || {};
	
	// 上传文件
	// opt: scope, check, onload, onerror, onprogress, onloadstart, param
	$we.files.uploadFiles = function(url, key, file, opt){
		//return false;
		if(window.XMLHttpRequestUpload && window.File && window.FileList && window.Blob){}else{
			return false;
		}
		opt = opt || {};
		opt.scope = opt.scope || window;
		
		// 发送前验证， 比如什么大小啊什么的
		if(opt.check){
			if(opt.check.call(opt.scope, file) === false){
				return true;
			}
		}
		
		var xhr = new XMLHttpRequest();
		xhr.open('POST', url);
		
		
		xhr.onload = function() {
			opt.onload && opt.onload.call(opt.scope, this);
		};
		xhr.onerror = function() {
			opt.onerror && opt.onerror.call(opt.scope, this);
		};
		xhr.upload.onprogress = function(e) {
			opt.onprogress && opt.onprogress.call(opt.scope, e);
		};
		xhr.upload.onloadstart = function(e) {
			opt.onstart && opt.onstart.call(opt.scope, e);
		};

		// prepare FormData
		var formData = new FormData();
		formData.append(key, file);
		for(var name in (opt.param || {})){
			formData.append(name, opt.param[name]);
		}
		xhr.send(formData);
		return true;
	};
})($we);(function($we){
	$we.cookie = $we.cookie || {};
	
	$we.cookie.get = function (name){
		var arr = document.cookie.match(new RegExp("(^| )" + name + "=([^;]*)(;|$)"));
		if(arr != null){
			return unescape(arr[2]);
		}
		return null;
	};
	
	$we.cookie.set = function (name,value,expires,domainValue,path){
		var cookieValue = name + "=" + escape(value);
		if(domainValue != null){
			cookieValue += ";domain=" + domainValue;
		}
		if(path != null){
			cookieValue += ";path=/" + path;
		}else{
			cookieValue += ";path=/";
		}
		if(expires != null && expires != 0){
			var exp=new Date();
			exp.setTime(exp.getTime() + expires * 24 * 60 * 60 * 1000);
			cookieValue += ";expires=" + exp.toGMTString();
		}
		document.cookie = cookieValue;
	};
})($we);(function($we){
	$we.ajax = $we.ajax || {};
	
	var _maxId = 0;
	
	var AjaxPromise = function(cb, scope){
		this.list = {};
		this.pending = {};
		this.cb = cb;
		this.scope = scope;
		this.bFinish = false;
	};
	
	var ajaxPromiseCheck = function(){
		for(var id in this.pending){
			if(this.pending[id]){
				var bFinish = true,
					dependence = this.pending[id].dependence,
					data = this.pending[id].data;
				for(var i=0;i<dependence.length;++i){
					if(!this.list[dependence]){
						bFinish = false;
						break;
					}
				}
				if(bFinish){
					ajaxRequest.call(this, data, id);
					this.pending[id] = null;
				}
			}
		}
		if(!this.bFinish){
			return;
		}
		for(var id in this.list){
			if(!this.list[id]){
				return;
			}
		}
		this.cb && this.cb.call(this.scope);
	};
	
	var ajaxRequest = function(data, id){
		this.list[id] = false;
		var success = data.success,
			error = data.error,
			context = data.context;
		data.context = this;
		data.success = function(data){
			this.list[id] = true;
			if(success){
				if(false === success.call(context, data)){
					return;
				}
			}
			ajaxPromiseCheck.call(this);
		};
		data.error = function(){
			this.list[id] = true;
			if(error){
				if(false === error.call(context)){
					return;
				}
			}
			ajaxPromiseCheck.call(this);
		};
		$.ajax(data);
	};
	
	AjaxPromise.prototype.add = function(data, dependence){
		var id = ++_maxId;
		if(dependence){
			this.pending[id] = {
				data : data,
				dependence : dependence
			};
		}else{
			ajaxRequest.call(this, data, id);
		}
		return id;
	};
	
	AjaxPromise.prototype.check = function(){
		this.bFinish = true;
		ajaxPromiseCheck.call(this);
	};
	
	$we.ajax.merge = function(cb, scope){
		return new AjaxPromise(cb, scope);
	};
	
	$we.ajax.post = function(cb, scope, func){
		var param = [];
		for(var i=3;i<arguments.length;++i){
			param.push(arguments[i]);
		}
		$.ajax({
			url : "/postInterface",
			data : {
				func : func,
				param : $we.json.toJSON(param)
			},
			type : "post",
			dataType : "text",
			success : function(str){
				var data = $we.json.get($we.json.toObject(str), "data");
				cb.call(scope, data);
			}
		});
	};
	
	$we.ajax.keeppost = function(cb, scope, func){
		var param = [];
		for(var i=3;i<arguments.length;++i){
			param.push(arguments[i]);
		}
		$.ajax({
			url : "/postInterface",
			data : {
				func : func,
				param : $we.json.toJSON(param),
				keep : "true"
			},
			type : "post",
			dataType : "text",
			success : function(str){
				var data = $we.json.get($we.json.toObject(str), "data");
				cb.call(scope, data);
			}
		});
	};
})($we);(function($we){
	$we.dom = $we.dom || {};
	
	var div = null;
	
	$we.dom.imgCb = function (img, cb, scope){
		if(img.complete || img.readyStatus == "complete"){
			cb.call(scope || img, img);
			return;
		}else{
			$(img).bind("load", function(e){
				cb.call(scope || img, img);
			});
		}
	};
	
	$we.dom.isParent = function(parent, node, bIgnoreSelf){
		if ( !parent || !node || (parent == node && !bIgnoreSelf) ){
			return true;
		}
		while ( node = node.parentNode ){
			if ( node == parent ){
				return true;
			}
		}
		return false;
	};
	
	$we.dom.removeDomNode = function(node){
		if(node && node.parentNode){
			node.parentNode.removeChild(node);
		}
	};
	
	$we.dom.removeAllChilds = function(node){
		var childs = node.childNodes;
		for(var i=childs.length-1;i>=0;--i){
			node.removeChild(childs[i]);
		}
	};
	
	$we.dom.getDomPosition = function (obj, bFixed){
		var x = y = 0;
		if(!bFixed && obj.getBoundingClientRect){
			var box = obj.getBoundingClientRect();
			var D = document.documentElement;
			x = box.left + Math.max(D.scrollLeft, document.body.scrollLeft) - D.clientLeft;
			y = box.top + Math.max(D.scrollTop, document.body.scrollTop) - D.clientTop;
		}else{
			for(;obj!= document.body; obj = obj.offsetParent){
				if(bFixed && (obj.style.position.toLowerCase() == "fixed" || obj.style.position.toLowerCase() == "absolute")){
					break;
				}
				x += obj.offsetLeft;
				y += obj.offsetTop;
			}
		}
		return {
			"x": x,
			"y": y
		};
	};
	
	$we.dom.getSize = function(obj){
		return {
			w : obj.offsetWidth,
			h : obj.offsetHeight
		};
	};
	
	$we.dom.canSee = function (el){
		var num = $we.dom.getDomPosition(el).y;
		if(num >= $we.dom.getScrollTop() && (num <= $we.dom.getScrollTop() + $we.dom.getClientHeight())){
			return true;
		}
		return false;
	};
	
	$we.dom.slideTo = function (el){
		var num;
		if($we.type(el) == $we.t.num){
			num = el
		}else{
			num = $we.dom.getDomPosition(el).y;
		}
		try{
			document.body.scrollTop = num;
		}catch(e){}
		try{
			document.documentElement.scrollTop = num;
		}catch(e){}
	};
	

	$we.dom.getScrollTop = function() {   
		return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
	};


	$we.dom.getScrollLeft = function() {
		return window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
	};


	$we.dom.getClientHeight = function() {   
		return (document.compatMode == "CSS1Compat")? document.documentElement.clientHeight : document.body.clientHeight; 
	};


	$we.dom.getClientWidth = function() {
		return (document.compatMode == "CSS1Compat")? document.documentElement.clientWidth : document.body.clientWidth; 
	};


	$we.dom.getScrollWidth = function() {   
		return (document.compatMode == "CSS1Compat")? document.documentElement.scrollWidth : document.body.scrollWidth;  
	};


	$we.dom.getScrollHeight = function() {   
		return (document.compatMode == "CSS1Compat")? document.documentElement.scrollHeight : document.body.scrollHeight;  
	};
	
	var buildEchoTree = function(html, data){
		var root = {
				parent : null,
				data : data,
				content : []
			},
			p = [root];
			matches = html.match(/\$\{[^\}]*\}\$/g),
			htmls = html.split(/\$\{[^\}]*\}\$/g),
			currIndex = 0;
		while(currIndex <= matches.length || currIndex <= htmls.length){
			if(htmls[currIndex]){
				p[0].content.push(htmls[currIndex]);
			}
			if(matches[currIndex]){
				var cont = $we.str.analyzeTplEcho(matches[currIndex]);
				if(cont){
					cont.parent = p[0];
					if($we.json.get(cont, "config.start") && (cont.echo == "if" || cont.echo == "list")){
						cont.content = [];
						p[0].content.push(cont);
						p.unshift(cont);
					}else if($we.json.get(cont, "config.end")){
						var t = p.shift();
						while(p.length >1 && t.echo != cont.echo){
							t = p.shift();
						}
					}else{
						p[0].content.push(cont);
					}
				}else{
					p[0].content.push(matches[currIndex]);
				}
			}
			++currIndex;
		}
		return root;
	};
	
	var clearAllData = function(tree){
		var clearTreeNode = function(node){
			node.data = null;
			for(var i=0;node.content && i<node.content.length;++i){
				if($we.type(node.content[i]) == $we.t.obj){
					clearTreeNode(node.content[i]);
				}
			}
		}
		clearTreeNode(tree);
	};
	
	var funcConfig = {};
	
	funcConfig.HTMLEncode = function(str){
		return $we.str.encodeHTML(str);
	};
	
	funcConfig.SubString = function(str, from, len, other){
		if($we.type(len) != $we.t.num){
			return str.substring(from);
		}
		if(str.length <= from + len){
			return str.substring(from);
		}else{
			return str.substring(from, len + from) + (other && other || "");
		}
	};
	
	var getValue = function(path, dataNode, funcList){
		var ret = null;
		while(dataNode){
			var paths = path.split("."),
				ret = $we.json.get(dataNode.data, paths);
			if(ret || $we.type(ret) == $we.t.str){
				break;
			}
			dataNode = dataNode.parent;
		}
		ret = ret || "";
		for(var i=0;i<funcList.length;++i){
			if(!funcConfig[funcList[i].func]){
				continue;
			}
			var param = $we.json.toObject($we.json.toJSON(funcList[i].param || []));
			param.unshift(ret);
			ret = funcConfig[funcList[i].func].apply(window, param);
		}
		return ret || "";
	};
	
	var echoBuildTree = function(tree){
		// �ݹ飬 �ȸ�����
		var html = "";
		var echoTreeNode = function(node){
			if(node.echo != "list" && node.echo != "if"){
				// ��ͨ�Ĵ�ӡ
				if(node.content){
					for(var i=0;i<node.content.length;++i){
						if($we.type(node.content[i]) == $we.t.str){
							html += node.content[i];
						}else{
							echoTreeNode(node.content[i]);
						}
					}
				}else{
					html += getValue(node.echo, node, node.funcList);
				}
			}else if(node.echo == "list"){
				var arr = getValue(node.config.path, node, node.funcList);
				for(var i=0;i<arr.length;++i){
					clearAllData(node);
					node.data = arr[i];
					for(var j=0;j<node.content.length;++j){
						if($we.type(node.content[j]) == $we.t.str){
							html += node.content[j];
						}else{
							echoTreeNode(node.content[j]);
						}
					}
				}
			}else if(node.echo == "if"){
				var data = getValue(node.echo, node, node.funcList);
				if(data){
					for(var i=0;i<node.content.length;++i){
						if($we.type(node.content[i]) == $we.t.str){
							html += node.content[i];
						}else{
							echoTreeNode(node.content[j]);
						}
					}
				}
			}
			
		}
		echoTreeNode(tree);
		return html;
	};
	
	$we.dom.appendHTML = function(el, html, data, method){
		// ��������ֱ���滻����ֱ���滻��
		html = ("" + html).replace(/\$(\w+)\$/g, function(a, b) {
			return typeof data[b] != "undefined" ? data[b] : "$" + b + "$"
		});
		div = div || document.createElement("div");
		// alert($we.json.toJSON(data));
		// ��ʼ������ӡ��
		var buildTree = buildEchoTree(html, data);
		//alert($we.json.toJSON(buildTree));
		div.innerHTML = echoBuildTree(buildTree);
		var els = $('[we-name]', div),
			arrEl = [];
		for(var i=0;i<els.length;++i){
			arrEl.push(els[i]);
		}
		while(div.firstChild){
			el.appendChild(div.firstChild);
		}
		for(var i=0;i<arrEl.length;++i){
			this.addDomWidget && this.addDomWidget(arrEl[i]);
		}
		this.execWidget && this.execWidget();
		//this.refreshDomTree && this.refreshDomTree();
	};
})($we);(function($we){
	$we.flash = $we.flash || {};
	
	$we.flash.getFlashVersion = function(){
		try {		// IE
			try {
				// avoid fp6 minor version lookup issues
				// see: http://blog.deconcept.com/2006/01/11/getvariable-setvariable-crash-internet-explorer-flash-6/
				var axo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash.6');
				try { axo.AllowScriptAccess = 'always'; }
				catch(e) { return '6,0,0'; }
			} catch(e) {}
			return new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version').replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];
			// other browsers
		} catch(e) {
			try {
				if(navigator.mimeTypes["application/x-shockwave-flash"].enabledPlugin){
					return (navigator.plugins["Shockwave Flash 2.0"] || navigator.plugins["Shockwave Flash"]).description.replace(/\D+/g, ",").match(/^,?(.+),?$/)[1];
				}
			} catch(e) {}
		}
		return 0;
	};
})($we);(function($we){
	$we.style = $we.style || {};
	
	var styleSheet = function(doc){
		this.doc = doc || document;
		this.styleSheet = this.doc.body.appendChild(this.doc.createElement("style"));
	};
	
	styleSheet.prototype.updateStyle = function(path, csses){
		var cssText = path + "{";
		for(var name in csses){
			if(csses[name]){
				cssText += name + ":" + csses[name] + ";";
			}
		}
		cssText += "}";
		if(this.styleSheet.styleSheet){
			this.styleSheet.styleSheet.cssText = cssText;
		}else{
			this.styleSheet.innerHTML = cssText;
		}
	};
	
	styleSheet.prototype.remove = function(){
		if(this.styleSheet.parentNode == this.doc.body){
			this.doc.body.removeChild(this.styleSheet);
		}
	};
	
	styleSheet.prototype.reload = function(){
		if(this.styleSheet.parentNode != this.doc.body){
			this.doc.body.appendChild(this.styleSheet);
		}
	};
	
	$we.style.createStyleSheet = function(doc){
		return new styleSheet(doc);
	};
	
	$we.style.addStyleSheet = function(style, mark, anchor){
		if(!anchor){
			$we.anchor = $we.anchor || {};
			anchor = $we.anchor;
		}
		if(anchor[mark]){
			return;
		}
		anchor[mark] = true;
		var div = document.body.appendChild(document.createElement("div"));
		div.innerHTML = [
			'<style>',
			style,
			'</style>'
		].join("");
	};
})($we);(function($we){
	$we.event = $we.event || {};
	
	$we.event.dispatchEvent = function(el, type, src){
		try{
			var evt = document.createEvent("Event");
			evt.initEvent(type, true, true);
			el.dispatchEvent(evt);
		}catch(e){}
	};
	
	$we.event.stopEvent = function (e){
		try{
			e.preventDefault();
		}catch(err){};
		try{
			e.returnValue = false;
		}catch(err){};
	};
	
	$we.event.stopBubble = function (e){
		e = e || event;
		try{// 非IE
			e.stopPropagation();
		}catch(err){}
		try{// IE
			e.cacelBubble();
		}catch(err){}
	};
	
	$we.event.stopEverything = function(e){
		$we.event.stopEvent(e);
		$we.event.stopBubble(e);
		return false;
	};
	
	var LaterEvent = function(time, func, scope){
		this.needCall = false;
		this.time = time;
		this.func = func;
		this.scope = scope;
	};
	
	LaterEvent.prototype.action = function(){
		this.later && clearTimeout(this.later);
		var me = this,
			argu = arguments;
		this.later = setTimeout(function(){
			me.func.apply(me.scope, argu);
		}, this.time);
	};
	
	$we.event.mergeLaterEvent = function(time, func, scope){
		return new LaterEvent(time, func, scope);
	};
})($we);(function($we){
	$we.event = $we.event || {};
	
	$we.event.getSrcEl = function (e){
		var event=window.event||e;
		var esrc = event.srcElement || event.target;
		return esrc;
	};
	
	$we.event.getCurPosition = function(e){
		e = e || window.event;
		var D = document.documentElement;
		if( e.pageX ){
			return {
				"x": e.pageX, 
				"y": e.pageY
			};
		}
		return {
			"x": e.clientX + D.scrollLeft - D.clientLeft,
			"y": e.clientY + D.scrollTop - D.clientTop
		};
	};
	
	$we.event.isMouseIn = function (e, el, option){
		var left = option && option.left || 0;
		var top = option && option.top || 0;
		var right = option && option.right || 0;
		var bottom = option && option.bottom || 0;
		var c = $we.event.getCurPosition(e);
		var p = $we.dom.getDomPosition(el);
		if(c.x >= p.x + left 
				&& c.x <= p.x + el.offsetWidth - 1 + right 
				&& c.y >= p.y + top
				&& c.y <= p.y + el.offsetHeight - 1 + bottom){
			return true;
		}
		return false;
	};
})($we);(function($we){
	$we.event = $we.event || {};
	
	var arrDocClick = [];
	
	$(window).bind("click", function(e){
		var src = $we.event.getSrcEl(e);
		for(var i=0;i<arrDocClick.length;++i){
			arrDocClick[i].func.call(arrDocClick[i].scope, e, src)
		}
	});
	
	$we.event.docClick = function(func, scope){
		arrDocClick.push({
			func : func,
			scope : scope || window
		});
	};
	
	$we.event.blurByClick = function(el, func, scope){
		var time = 0;
		$(el).on("blur", function(){
			time = + new Date;
		});
		$we.event.docClick(function(e, esrc){
			var abs = +new Date - time;
			if(abs > 0 && abs < 500){
				// 默认这种时长不能超过500毫秒
				// 将来想想有没有更好的检测方法
				func.call(scope || el, e, esrc);
			}
			time = 0;
		});
	};
	
	$we.event.makeDrag = function(sender, container, fnMousedown, fnMousemove, fnMouseup){
		return new _makeDrag(sender, container, fnMousedown, fnMousemove, fnMouseup);
	};
	
	var _makeDrag = function(sender, container, fnMousedown, fnMousemove, fnMouseup){
		if(!container){
			container = sender;
		}
		this.z_index = "9999";
		this.container = container;
		this.makeDrag_flag = false;
		if(typeof fnMousedown == "function"){
			this.fnMousedown = fnMousedown;
		}
		if(typeof fnMousemove == "function"){
			this.fnMousemove = fnMousemove;
		}
		if(typeof fnMouseup == "function"){
			this.fnMouseup = fnMouseup;
		}
		var me = this;
		$(sender).bind("mousedown", function(e){
			me.begin(e);
		});
	};
	
	_makeDrag.prototype.zIndex = function(num){
		this.z_index = num;
	};
	
	_makeDrag.prototype.begin = function(e){
		var mousemoveEvent = document.onmousemove;
		var mouseupEvent = document.onmouseup;
		var me = this;
		if(me.fnMousedown){
			me.fnMousedown(e);
		}
		var oPos = $we.dom.getDomPosition(me.container);
		var cPos = $we.event.getCurPosition(e);
		me.makeDrag_flag = true;
		document.onmouseup = function(e){
			if(!me.makeDrag_flag){
				return;
			}
			me.makeDrag_flag = false;
			// Problem: should we store the events
			document.onmousemove =mousemoveEvent;
			document.onmouseup = mouseupEvent;
			if(me.fnMouseup){
				me.fnMouseup(e);
			}
			return false;
		};
		document.onmousemove = function(e){
			if(me.makeDrag_flag){
				if(me.fnMousemove){
					me.fnMousemove(e);
				}
				document.body.appendChild(me.container);
				me.container.style.position = "absolute";
				me.container.style.zIndex = me.z_index;
				var Pos = $we.event.getCurPosition(e);
				me.container.style.left = Pos.x - cPos.x + oPos.x + "px";
				me.container.style.top = Pos.y - cPos.y + oPos.y + "px";
			}
			return false;
		};
		if(e.preventDefault)
			e.preventDefault();
		return false;
	};
	
	$we.event.switchDisplay = function (el, text, css, focusCb, blurCb, scope){
		css = css || "write";
		focusCb = focusCb || function(){};
		blurCb = blurCb || function(){};
		scope = scope || window;
		$(el).unbind("blur");
		$(el).unbind("focus");
		$(el).bind("blur", function(){
			if(el.value == "" || el.value == text){
				el.value = text;
				if(css){
					$(el).removeClass(css);
				}
			}
			blurCb.call(scope);
		});
		$(el).bind("focus", function(){
			if(el.value == "" || el.value == text){
				el.value = "";
				if(css){
					$(el).addClass(css);
				}
			}
			focusCb.call(scope);
		});
	};
	
	
	
	var clusureData = {
		bindElEvent : [],
		addEvent : {
			arriveTop : [],
			leaveTop : [],
			arriveBottom : []
		}
	};
	
	// -----------------------------------------------------
	var _ariveLeave = function(e){
		//alert("test");
		var clientHeight = $we.dom.getClientHeight(),
			scrollTop = $we.dom.getScrollTop(),
			totleHeight = $we.dom.getScrollHeight(),
			realTop = totleHeight - clientHeight - scrollTop;
		$we.arr.each(clusureData.addEvent.arriveTop, function(item){
			if(scrollTop <= item.distance){
				item.func.apply(item.scope || window, item.param || []);
			}
		});
		$we.arr.each(clusureData.addEvent.leaveTop, function(item){
			if(scrollTop > item.distance){
				item.func.apply(item.scope || window, item.param || []);
			}
		});
		$we.arr.each(clusureData.addEvent.arriveBottom, function(item){
			if(item.distance >= realTop){
				item.func.apply(item.scope || window, item.param || []);
			}
		});
	};
	
	$we.event.arriveTop = function(func, distance, scope, param){
		clusureData.addEvent.arriveTop.push({
			func : func,
			distance : distance,
			scope : scope, 
			param : param
		});
		$we.event.startWindowPosEvent();
	};
	
	$we.event.unArriveTop = function(func){
		$we.arr.remove(clusureData.addEvent.arriveTop, function(item){
			return func == item.func;
		});
		$we.event.startWindowPosEvent();
	};
	
	$we.event.leaveTop = function(func, distance, scope, param){
		clusureData.addEvent.leaveTop.push({
			func : func,
			distance : distance,
			scope : scope, 
			param : param
		});
		$we.event.startWindowPosEvent();
	};
	
	$we.event.unLeaveTop = function(func){
		$we.arr.remove(clusureData.addEvent.leaveTop, function(item){
			return func == item.func;
		});
		$we.event.startWindowPosEvent();
	};
	
	$we.event.arriveBottom = function(func, distance, scope, param){
		clusureData.addEvent.arriveBottom.push({
			func : func,
			distance : distance,
			scope : scope, 
			param : param
		});
		$we.event.startWindowPosEvent();
	};
	
	$we.event.unArriveBottom = function(func){
		$we.arr.remove(clusureData.addEvent.arriveBottom, function(item){
			return func == item.func;
		});
		$we.event.startWindowPosEvent();
	};
	
	$we.event.startWindowPosEvent = function(forceCheck){
		/*
		$we.dom.stopWindowPosEvent();
		if(clusureData.addEvent.arriveTop.length > 0
			|| clusureData.addEvent.leaveTop.length > 0
			|| clusureData.addEvent.arriveBottom.length > 0){
			$we.dom.makeEventCall(window, _ariveLeave, "resize");
			$we.dom.makeEventCall(window, _ariveLeave, "scroll");
		}
		if(forceCheck){
			_ariveLeave();
		}
		*/
	};
	
	$we.event.stopWindowPosEvent = function(){
		/*
		$we.dom.removeEventCall(window, _ariveLeave, "scroll");
		$we.dom.removeEventCall(window, _ariveLeave, "resize");
		*/
	};
	
	$(window).on("resize", _ariveLeave);
	$(window).on("scroll", _ariveLeave);
})($we);(function($we){
	$we.json = {};
	
	$we.json.get = function (json, path){
		var data = json;
		if(!data){
			return null;
		}
		if(typeof path == "string"){
			path = path.split(".");
		}
		for(var i=0;i<path.length;++i){
			try{
				data = data[path[i]];
			}catch(e){
				return null;
			}
		}
		return data;
	};
	
	$we.json.each = function (json, func, scope){
		if($we.type(json) != $we.t.obj){
			return;
		}
		scope = scope || window;
		for(var name in json){
			var b = func.call(scope, json[name], name);
			if(b === false){
				break;
			}
		}
	};
	
	var space = $we.json;
	
	var _nToU = function(num, len){
		var _0 = "a".charCodeAt(0);
		var dToH = function(n){
			if(n < 10){
				return "" + n;
			}else{
				return String.fromCharCode(_0 + n - 10);
			}
		};
		var ret = "";
		while(num){
			ret = dToH(num % 16) + ret;
			num = Math.floor(num / 16);
		}
		if(ret.length == 0){
			ret = "0";
		}
		while(len && ret.length < len){
			ret = "0" + ret;
		}
		return ret;
	};
	
	var nToU = function(num){
		var ret = _nToU(num, 4);
		return "\\u" + ret;
	};
	$we.json.format = function(str){
		return str.replace(/[^\u0000-\u007f\s\\\/\'\"\n\r\t\b\f]/g, function(a){
			return nToU(a.charCodeAt(0));
		});
	};
	var strToJSON = function(str){
		var tmp = str.split("");
		for(var i=0;i<tmp.length;++i){
			var c = tmp[i];
			if('/' == c){
				tmp[i] = '\\\/';
			}else if('\\' == c){
				tmp[i] = '\\\\';
			}else if('"' == c){
				tmp[i] = '\\\"';
			}else if('\'' == c){
				tmp[i] = '\'';
			}else if('\n' == c){
				tmp[i] = '\\n';
			}else if('\r' == c){
				tmp[i] = '\\r';
			}else if('\t' == c){
				tmp[i] = '\\t';
			}else if('\b' == c){
				tmp[i] = '\\b';
			}else if('\f' == c){
				tmp[i] = '\\f';
			}else if(c.charCodeAt(0) <= 127){
				// TODO
			}else{
				tmp[i] = nToU(c.charCodeAt(0));
			}
		}
		return '"' + tmp.join("") + '"';
	};
	var arrToJSON = function(arr){
		for(var i=0, json=[];i<arr.length;++i){
			try{
				if(arr[i] != null)
					json[i] = space.toJSON(arr[i]);
				else
					json[i] = "null";
			}catch(e){
				json[i] = arr[i];
			}
		}
		return "[" + json.join(",") + "]";
	};
	var objToJSON = function(v){
		var json = [];
		for(var i in v){
			if(!v.hasOwnProperty(i))
				continue;
			json.push(
				[space.toJSON(i), (v[i] != null) ? space.toJSON(v[i]) : "null"].join(":")
			);
		}
		return "{" + json.join(",") + "}";
	};
	var bolToJSON = function(v){
		if(v){
			return "true";
		}
		return "false";
	};
	space.toJSON = function(v){
		switch(Object.prototype.toString.apply(v).toLowerCase()){
		case "[object string]":
			return strToJSON(v);
		case "[object array]":
			return arrToJSON(v);
		case "[object object]":
			return objToJSON(v);
		case "[object boolean]":
			return bolToJSON(v);
		case "[object number]":
			return "" + v;
		default:
			return "null";
		}
	};
	
	var isNum = function(ch){
		var character = ch.charCodeAt(0);
		if(character >= 48 && character <= 57){
			return true;
		}
		return false;
	};
	
	var isChar = function(ch, state){
		// 如果是一般的字符串， 那么只有大小写字母和下划线能叫字符串
		var character = ch.charCodeAt(0);
		if(character >= 97 && character <= 122 || character >= 65 && character <= 90 || character == 95){
			return true;
		}
		return false;
	};
	
	var isBlank = function(ch){
		if(" \n\t".indexOf(ch) != -1){
			return true;
		}
		return false;
	};
	var bindNameToObj = function(state, str){
		var p = state.stack[state.stack.length - 1];
		switch(Object.prototype.toString.apply(p).toLowerCase()){
		case "[object object]":
			// 这个是对的
			break;
		default:
			throw new Error("Has a name but not for any object");
			return;
		}
		var bNeedAdd = true;
		for(var i=0;i<state.mapNameToObj.length;++i){
			// {obj, name}
			var item = state.mapNameToObj[i];
			if(item.obj == p){
				item.name = str;
				bNeedAdd = false;
				break;
			}
		}
		if(bNeedAdd){
			state.mapNameToObj.push({
				obj : p,
				name : str
			});
		}
	};
	var getNameFromObj = function(state, p, str){
		for(var i=0;i<state.mapNameToObj.length;++i){
			if(state.mapNameToObj[i].obj == p){
				p[state.mapNameToObj[i].name] = str;
				break;
			}
		}
	};
	var addToStack = function(state, currState, nextState, str, bNeedExec){
		// 如果结果都出来了， 还有这类操作， 对不起， 挂了
		if(state.result){
			throw new Error("Result Already Calculated, but statement is not END");
		}
		if(typeof str == "string" || typeof str == "number"){
			// 加入的字符串是计算的一部分
			if(bNeedExec){
				try{
					str = eval(str);
				}catch(e){
					throw new Error("Error in execute str" + str);
				}
			}
			var p = state.stack[state.stack.length - 1];
			switch(Object.prototype.toString.apply(p).toLowerCase()){
			case "[object array]":
				p.push(str);
				break;
			case "[object object]":
				getNameFromObj(state, p, str);
				break;
			default:
				break;
			}
		}
		// 如果是数组结束， 对象结束， 那么还需要处理一下
		if(nextState == 6 || nextState == 9){
			var v = state.stack.pop();
			// 做一次检查， 万一不匹配， 需要报错
			switch(Object.prototype.toString.apply(v).toLowerCase()){
			case "[object array]":
				if(nextState == 9){	// 是数组， 但是下一个状态却是对象结束
					throw new Error("Expect Object End but give me Array");
				}
				break;
			case "[object object]":
				if(nextState == 6){	// 是对象， 但是下一个状态却是数组结束
					throw new Error("Expect Array End but give me Object");
				}
				break;
			default:
				break;
			}
			if(state.stack.length == 0){
				state.result = v;
				state.currState = 11;
			}else{
				var p = state.stack[state.stack.length - 1];
				switch(Object.prototype.toString.apply(p).toLowerCase()){
				case "[object array]":
					// 是
					p.push(v);
					break;
				case "[object object]":
					getNameFromObj(state, p, v);
					break;
				default:
					break;
				}
			}
		}
	};
	var toObject = function(str){
		// 移除所有的注释
		str = str.replace(/\/\*(.*?)\*\//gi, "");
		str = str.replace(/\/\/[^\n]*/gi, "");
		// 正式开始解析
		// 状态值
		// 0 : 开始
		// 1 : 数字
		// 2 : 字符串
		// 3 : 带引号的字符串
		// 4 : 带引号字符串结束
		// 5 : 数组
		// 6 : 数组结束
		// 7 : 对象名
		// 8 : 对象体
		// 9 : 对象结束
		// 10 : 判断
		// 11 : 全部结束
		// 12 : 字符串结束
		// 14 : 数字结束
		// var arr = new String(str),
		var arr = str.split(""),
			state = {
				bSpecial : false,
				stack : [],
				begin : 0,
				currState : 0,
				mapNameToObj : []
			};
		for(state.curr=0;state.curr<arr.length;++state.curr){
			var ch = arr[state.curr];
			switch(state.currState){
			case 10:
			case 0:		// 0 : 开始
				if(isBlank(ch)){
					// 啥也不做
				}else if(isNum(ch)){
					state.begin = state.curr;
					state.currState = 1;
				}else if(isChar(ch)){
					state.begin = state.curr;
					state.currState = 2;
				}else if(ch == '"' || ch == "'"){
					state.begin = state.curr+1;
					state.strMark = ch;
					state.currState = 3;
				}else if(ch == '['){
					state.stack.push([]);
					state.currState = 5;
				}else if(ch == '{'){
					state.stack.push({});
					state.currState = 7;
				}else{
					throw new Error("Error When Begin");
				}
				break;
			case 1:		// 1 : 数字
				if(isBlank(ch)){
					state.currNum = eval(str.substring(state.begin, state.curr));
					state.currState = 14;
				}else if(isNum(ch)){
				}else if(ch == ']'){
					var num = eval(str.substring(state.begin, state.curr));
					addToStack(state, state.currState, 6, num);
					state.currState = 6;
				}else if(ch == '}'){
					var num = eval(str.substring(state.begin, state.curr));
					addToStack(state, state.currState, 9, num);
					state.currState = 9;
				}else if(ch == ','){
					var num = eval(str.substring(state.begin, state.curr));
					addToStack(state, state.currState, 10, num);
					state.currState = 10;
				}else{
					throw new Error("Error In Number");
				}
				break;
			case 2:		// 2 : 字符串
				if(isBlank(ch)){
					// 不带引号的字符串结束
					// 应该补一个状态， 但是偷一下懒
					state.currStr = str.substring(state.begin, state.curr);
					state.needEval = true;
					state.currState = 12;
				}else if(isNum(ch) || isChar(ch, state)){
				}else if(ch == ']'){
					addToStack(state, state.currState, 6, str.substring(state.begin, state.curr), true);
					state.currState = 6;
				}else if(ch == '}'){
					addToStack(state, state.currState, 9, str.substring(state.begin, state.curr), true);
					state.currState = 9;
				}else if(ch == ','){
					addToStack(state, state.currState, 10, str.substring(state.begin, state.curr), true);
					state.currState = 10;
				}else if(ch == ':'){
					bindNameToObj(state, str.substring(state.begin, state.curr));
					state.currState = 8;
				}else{
					throw new Error("Error In String");
				}
				break;
			case 3:		// 3 : 带引号的字符串
				if(ch == state.strMark && (arr[state.curr-1] != "\\")){
					state.needEval = false;
					state.currStr = eval(state.strMark + str.substring(state.begin, state.curr) + state.strMark);
					state.currState = 4;
				}
				break;
			case 4:		// 4 : 带引号字符串结束
				if(isBlank(ch)){
					// 啥都不用做
				}else if(ch == ']'){
					addToStack(state, state.currState, 6, state.currStr);
					state.currState = 6;
				}else if(ch == ':'){
					bindNameToObj(state, state.currStr);
					state.currState = 8;
				}else if(ch == '}'){
					addToStack(state, state.currState, 9, state.currStr);
					state.currState = 9;
				}else if(ch == ','){
					addToStack(state, state.currState, 10, state.currStr);
					state.currState = 10;
				}else{
					throw new Error("Error In String");
				}
				break;
			case 5:		// 5 : 数组
				if(isBlank(ch)){
					// 啥也不用做
				}else if(isNum(ch)){
					state.begin = state.curr;
					state.currState = 1;
				}else if(isChar(ch)){
					state.begin = state.curr;
					state.currState = 2;
				}else if(ch == '"' || ch == "'"){
					state.begin = state.curr+1;
					state.strMark = ch;
					state.currState = 3;
				}else if(ch == '['){
					state.stack.push([]);
				}else if(ch == ']'){
					addToStack(state, state.currState, 6);
					state.currState = 6;
				}else if(ch == '{'){
					state.stack.push({});
					state.currState = 7;
				}else{
					throw new Error("Error In Array");
				}
				break;
			case 6:		// 6 : 数组结束
				if(isBlank(ch)){
					// 啥也不用做
				}else if(ch == ']'){
					addToStack(state, state.currState, 6);
				}else if(ch == '}'){
					addToStack(state, state.currState, 9);
					state.currState = 9;
				}else if(ch == ','){
					//addToStack(state, currState, 10);
					state.currState = 10;
				}else{
					throw new Error("Error In Array");
				}
				break;
			case 7:		// 7 : 对象名
				if(isBlank(ch)){
					// 啥也不用做
				}else if(isNum(ch) || isChar(ch, state)){
					state.begin = state.curr;
					state.currState = 2;
				}else if(ch == '"' || ch == "'"){
					state.begin = state.curr+1;
					state.strMark = ch;
					state.currState = 3;
				}else{
					throw new Error("Error In Object Name");
				}
				break;
			case 8:		// 8 : 对象体
				if(isBlank(ch)){
					// 啥也不用做
				}else if(isChar(ch)){
					state.begin = state.curr;
					state.currState = 2;
				}else if(isNum(ch)){
					state.begin = state.curr;
					state.currState = 1;
				}else if(ch == '"' || ch == "'"){
					state.begin = state.curr+1;
					state.strMark = ch;
					state.currState = 3;
				}else if(ch == '['){
					state.stack.push([]);
					state.currState = 5;
				}else if(ch == '{'){
					state.stack.push({});
					state.currState = 7;
				}else{
					throw new Error("Error In Object");
				}
				break;
			case 9:		// 9 : 对象结束
				if(isBlank(ch)){
					// 啥也不用做
				}else if(ch == ']'){
					addToStack(state, state.currState, 6);
					state.currState = 6;
				}else if(ch == '}'){
					addToStack(state, state.currState, 9);
				}else if(ch == ','){
					//addToStack(state, currState, 10);
					state.currState = 10;
				}else{
					throw new Error("Error In Object Ending");
				}
				break;
			case 12:	// 12 : 字符串结束
				if(isBlank(ch)){
					// 啥都不用做
				}else if(ch == ']'){
					addToStack(state, state.currState, 6, state.currStr, state.needEval);
					state.currState = 6;
				}else if(ch == ':'){
					bindNameToObj(state, state.currStr);
					state.currState = 8;
				}else if(ch == '}'){
					addToStack(state, state.currState, 9, state.currStr, state.needEval);
					state.currState = 9;
				}else if(ch == ','){
					addToStack(state, state.currState, 10, state.currStr, state.needEval);
					state.currState = 10;
				}else{
					throw new Error("Error In String");
				}
				break;
			case 14:	// 14 : 数字结束
				if(isBlank(ch)){
					// 啥也不用做
				}else if(ch == ']'){
					addToStack(state, state.currState, 6, state.currNum);
					state.currState = 6;
				}else if(ch == '}'){
					addToStack(state, state.currState, 9, state.currNum);
					state.currState = 9;
				}else if(ch == ','){
					addToStack(state, state.currState, 10, state.currNum);
					state.currState = 10;
				}else{
					throw new Error("Error In Number End");
				}
				break;
			case 11:	// 11 : 结构已经有了， 那么出现任何非空字符， 都将认为是错误的
				if(isBlank(ch)){
					// 啥也不用做
				}else{
					throw new Error("Result has been calculted but statement is not END");
				}
			default:
				break;
			}
		}
		return state.result || state.currStr;
	};
	
	space.toObject = function(str, bNotTrust){
		if(bNotTrust){
			return toObject(str);
		}
		try{
			return eval("(" + str + ")");
		}catch(e){
			return null;
		}
	};
})($we);(function($we){
	$we.str = $we.str || {};
	
	$we.str.trim = function (str){
		return ("" + str).replace(/^[\s\xa0\u3000]+|[\u3000\xa0\s]+$/g, "");
	};
	
	$we.str.changeNumMoneyToChinese = function(money){
		var cnNums = new Array("零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"); //汉字的数字
		var cnIntRadice = new Array("", "拾", "佰", "仟"); //基本单位
		var cnIntUnits = new Array("", "万", "亿", "兆"); //对应整数部分扩展单位
		var cnDecUnits = new Array("角", "分", "毫", "厘"); //对应小数部分单位
		var cnInteger = "整"; //整数金额时后面跟的字符
		var cnIntLast = "元"; //整型完以后的单位
		var maxNum = 999999999999999.9999; //最大处理的数字
		var IntegerNum; //金额整数部分
		var DecimalNum; //金额小数部分
		var ChineseStr = ""; //输出的中文金额字符串
		var parts; //分离金额后用的数组，预定义
		if (money == "") {
			return "";
		}
		money = parseFloat(money);
		if (money >= maxNum) {
			alert('超出最大处理数字');
			return "";
		}
		if (money == 0) {
			ChineseStr = cnNums[0] + cnIntLast + cnInteger;
			return ChineseStr;
		}
		money = money.toString(); //转换为字符串
		if (money.indexOf(".") == -1) {
			IntegerNum = money;
			DecimalNum = '';
		} else {
			parts = money.split(".");
			IntegerNum = parts[0];
			DecimalNum = parts[1].substr(0, 4);
		}
		if (parseInt(IntegerNum, 10) > 0) { //获取整型部分转换
			var zeroCount = 0;
			var IntLen = IntegerNum.length;
			for (var i = 0; i < IntLen; i++) {
				var n = IntegerNum.substr(i, 1);
				var p = IntLen - i - 1;
				var q = p / 4;
				var m = p % 4;
				if (n == "0") {
					zeroCount++;
				} else {
					if (zeroCount > 0) {
						ChineseStr += cnNums[0];
					}
					zeroCount = 0; //归零
					ChineseStr += cnNums[parseInt(n)] + cnIntRadice[m];
				}
				if (m == 0 && zeroCount < 4) {
					ChineseStr += cnIntUnits[q];
				}
			}
			ChineseStr += cnIntLast;
			//整型部分处理完毕
		}
		if (DecimalNum != '') { //小数部分
			var decLen = DecimalNum.length;
			for (var i = 0; i < decLen; i++) {
				var n = DecimalNum.substr(i, 1);
				if (n != '0') {
					ChineseStr += cnNums[Number(n)] + cnDecUnits[i];
				}
			}
		}
		if (ChineseStr == '') {
			ChineseStr += cnNums[0] + cnIntLast + cnInteger;
		} else if (DecimalNum == '') {
			ChineseStr += cnInteger;
		}
		return ChineseStr;
	}
	
	$we.str.removeTag = function (ret, tag){
		if(!tag){
			ret = ret.replace(/<(.*?)>/gi, "");
		}else{
			var reg1 = new RegExp("<" + tag + "([\\s][^>]*)>|<" + tag + ">", "gi");
			ret = ret.replace(reg1, "");
			var reg2 = new RegExp("<\\\/" + tag + "([\\s][^>]*)>|<\\\/" + tag + ">", "gi");
			ret = ret.replace(reg2, "");
		}
		return ret;
	};
	
	$we.str.uToN = function (n){
		var ret = 0;
		n = n.toLowerCase();
		var _0 = "0".charCodeAt(0);
		var _9 = "9".charCodeAt(0);
		var _a = "a".charCodeAt(0);
		var _z = "z".charCodeAt(0);
		for(var i=0;i<n.length;++i){
			var t = n.charCodeAt(i);
			if(t >= _0 && t<= _9){
				t -= _0;
			}else if(t >= _a && t<= _z){
				t = t + 10 - _a;
			}else{
				t = 0;
			}
			ret = ret * 16 + t;
		}
		return ret;
	};
	
	$we.str.nToU = function (num, len){
		var _0 = "a".charCodeAt(0);
		var dToH = function(n){
			if(n < 10){
				return "" + n;
			}else{
				return String.fromCharCode(_0 + n - 10);
			}
		};
		var ret = "";
		while(num){
			ret = dToH(num % 16) + ret;
			num = Math.floor(num / 16);
		}
		if(ret.length == 0){
			ret = "0";
		}
		while(len && ret.length < len){
			ret = "0" + ret;
		}
		return ret;
	};
	
	$we.str.reverseColor = function (z){
		if(z.substr(0,1) == '#'){
			x = z.substr(1);
		}
		if(x.length == 3){
			var a = x.substr(0, 1)+x.substr(0, 1);
			var b = x.substr(1, 1)+x.substr(1, 1);
			var c = x.substr(2, 1)+x.substr(2, 1);
		}else{
			var a = x.substr(0, 2);
			var b = x.substr(2, 2);
			var c = x.substr(4, 2);
		}
		var a1 = 255-parseInt(a,16);
		var b1 = 255-parseInt(b,16);
		var c1 = 255-parseInt(c,16);
		var a2 = a1.toString(16);
		var b2 = b1.toString(16);
		var c2 = c1.toString(16);
		if(a2.length == 1){
			a2 += a2;
		}
		if(b2.length == 1){
			b2 += b2;
		}
		if(c2.length == 1){
			c2 += c2;
		}
		r = a2+b2+c2;
		if(z.substr(0,1) == '#'){
			r = '#'+r;
		}
		return r;
	};
	
	$we.str.encodeHTML = function (str, other){
		str = ("" + str).replace(/&/g, '&amp')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;')
			.replace(/</g, '&lt;')
			.replace(/ /g, '&#160;')
			.replace(/\t/g, '&#160;&#160;&#160;&#160;')
			.replace(/>/g, '&gt;')
			.replace(/\n/g, '<br>');
		if(other){
			for(var i=0; i < other.length; ++i){
				str = str.replace(other[i].key, other[i].value);
			}
		}
		return str;
	};
	
	$we.str.replace = function(str, json){
		return (""+str).replace(/\$(\w+)\$/g,function(a, b) {return typeof json[b] != "undefined" ? json[b] : "$" + b + "$"});
	};

	$we.str.decodeBase52 = function(strOrigen){
		var decodeLetter = function( str ){
			var length = str.length;
			var asc = 0;
			var i = 0;
			var n = 0;
			for(i=length-1;i>=0;--i){
				n = str.charCodeAt(i);
				asc *= 52;
				if(n<91){
					asc += n - 65;
				}else{
					asc += n - 71;
				}
			}
			return String.fromCharCode(asc);
		};
		var length = strOrigen.length;
		var result = "";
		var pCurrent = 0;
		var asc = 0;
		while(pCurrent < length){
			asc = strOrigen.charCodeAt(pCurrent);
			if(asc > 48 && asc <= 57 ){
				asc -= 48;
			}else{
				++pCurrent;
				result += String.fromCharCode(asc);
				continue;
			}
			result += decodeLetter( strOrigen.substring(pCurrent+1,pCurrent+asc+1));
			pCurrent += asc + 1;
		}
		return result;
	};
	
	$we.str.encodeBase52 = function(strOrigen){
		var encodeLetter = function( n ){
			if((n>96&&n<123) || (n>64&&n<91)){
				return String.fromCharCode(n);
			}
			if(n<0){
				n += 65536;
			}
			var temp = 0;
			var result = "";
			do{
				temp = n % 52;
				if(temp <26 ){
					result += String.fromCharCode(temp+65);
				}else{
					result += String.fromCharCode(temp+71);
				}
				n = Math.floor(n / 52);
			} while(n != 0)
			return ["",result.length,result].join("");
		};
		var length = strOrigen.length;
		var result = "";
		var i = 0;
		for(i=0;i<length;++i){
			result += encodeLetter(strOrigen.charCodeAt(i));
		}
		return result;
	};
	
	$we.str.getHTMLAttr = function(html, attr){
		var reg = new RegExp('(' + attr + '[^a-zA-Z0-9]*?[\'\"])(([^\'\"]*)?)([\'\"])', "gi");
		var ret = html.match(reg);
		if(ret && ret.length){
			ret = ret[0].match(/['"](([^'"]*)?)(['"])/gi);
			if(ret && ret.length){
				return ret[0].replace(/"/gi, "").replace(/'/gi, "");
			}
		}
		return null;
	};
	
	$we.str.removeHTMLTag = function(ret, tag){
		if(!tag){
			ret = ret.replace(/<(.*?)>/gi, "");
		}else{
			var reg1 = new RegExp("<" + tag + "([\\s][^>]*)>|<" + tag + ">", "gi");
			ret = ret.replace(reg1, "");
			var reg2 = new RegExp("<\\\/" + tag + "([\\s][^>]*)>|<\\\/" + tag + ">", "gi");
			ret = ret.replace(reg2, "");
		}
		return ret;
	};
	
	$we.str.comVersion = function(strBase, strVersion){
		var p1 = strBase.split("."), p2 = strVersion.split("."), i = 0;
		while(i < p1.length && i < p2.length){
			if(parseInt(p1[i]) > parseInt(p2[i]))
				return true;
			if(parseInt(p1[i]) < parseInt(p2[i]))
				return false;
			++i;
		}
		if(p1.length >= p2.length){
			return true;
		}
		return false;
	};
	
	$we.str.getExtention = function(str){
		var n = str.lastIndexOf(".");
		if(n == -1 && n >= str.length){
			return null;
		}
		return str.substring(n + 1).toLowerCase();
	};
	
	$we.str.removeExtention = function(str, arr){
		var n = str.lastIndexOf(".");
		if(n == -1 && n >= str.length){
			return str;
		}
		var ext = str.substring(n + 1).toLowerCase();
		if(se.type(arr) == se.t.str){
			arr = [arr];
		}
		if(se.type(arr) == se.t.arr){
			se.arr.each(arr, function(str){
				str = str.toLowerCase();
			});
			if(se.arr.contain(arr, ext)){
				return str.substring(0, n);
			}else{
				return str;
			}
			return 
		}
		return str.substring(0, n);
	};
	
	$we.str.getByteLength = function(str, type){
		var value = str;
		var length = value.length;
		if(!type){
			type = 'utf8';
		}
		if('gbk'==type){
			var n = 1;
		} else if('utf8'==type){
			n = 2;
		}
		for(var i = 0; i < value.length; i++){
			if(value.charCodeAt(i) > 127){
				length += n;
			}
		}
		return length;
	};
	
	$we.str.utf8StrSub = function(str, len, flag){
		if(!str || !len) { return ''; }
		//Ԥ�ڼ���������3�ֽڣ�Ӣ��1�ֽ�
		var a = 0;
		//ѭ������
		var i = 0;
		//��ʱ�ִ�
		var temp = '';
		for(i=0;i<str.length;i++){
			if(str.charCodeAt(i)>255){
				//����Ԥ�ڼ�������2
				a+=3;
			}else{
				a++;
			}
			//������Ӽ����󳤶ȴ����޶����ȣ���ֱ�ӷ�����ʱ�ַ���
			if(a > len) { 
				if(flag==true)temp+="...";
				return temp; }
			//����ǰ���ݼӵ���ʱ�ַ���
			temp += str.charAt(i);
		}
		//���ȫ���ǵ��ֽ��ַ�����ֱ�ӷ���Դ�ַ���
		return str;
	}; // se("sdfsdfsdfsdf").utf8StrSub(10);
	
	$we.str.utf8StrLen = function(str){
		if(!str ) { return ''; }
		//Ԥ�ڼ���������3�ֽڣ�Ӣ��1�ֽ�
		var len = 0;
		//ѭ������
		var i = 0;
		//��ʱ�ִ�

		for(i=0;i<str.length;i++){
			if(str.charCodeAt(i)>255){
				//����Ԥ�ڼ�������3
				len+=3;
			}else{
				len++;
			}
		}
		//���س���
		return len;
	}; // se("sdfsdfsdfsdf").utf8StrLen();
	
	$we.str.strSub = function(str, len, flag){
		if(!str || !len) { return ''; }
		//Ԥ�ڼ���������2�ֽڣ�Ӣ��1�ֽ�
		var a = 0;
		//ѭ������
		var i = 0;
		//��ʱ�ִ�
		var temp = '';
		for(i=0;i<str.length;i++){
			if(str.charCodeAt(i)>255){
				//����Ԥ�ڼ�������2
				a+=2;
			}else{
				a++;
			}
			//������Ӽ����󳤶ȴ����޶����ȣ���ֱ�ӷ�����ʱ�ַ���
			if(a > len) { 
				if(flag==true)temp+="...";
				return temp; }
			//����ǰ���ݼӵ���ʱ�ַ���
			temp += str.charAt(i);
		}
		//���ȫ���ǵ��ֽ��ַ�����ֱ�ӷ���Դ�ַ���
		return str;
	};
	
	$we.str.addToClipBoard = function(str){
		if(window.clipboardData){
			window.clipboardData.setData("Text", str);
			return true;
		}
		return false;
	};

	$we.str.getInt = function(str){
		var regex = new RegExp("(\\d+)");
		var numbs = regex.exec(str);
		if(numbs && numbs.length >= 2){
			return parseInt(numbs[1]);
		};
		return 0;
	};
	
	$we.str.addStrNum = function(el, num){
		var v = el;
		if(se.type(v) == se.t.dom){
			v = el.innerHTML;
		}
		var n1 = $we.str.getInt(v);
		var n2 = n1 + num;
		v = v.replace(n1, n2);
		try{
			if(se.type(el) == se.t.dom){
				el.innerHTML = v;
			}
		}catch(e){}
		return v;
	};
	
	$we.str.escapeXml = function(str){
		return str.replace(/&/gm, "&amp;")
			.replace(/</gm, "&lt;")
			.replace(/>/gm, "&gt;")
			.replace(/"/gm, "&quot;");
	};

	$we.str.unescapeXml = function(str){
		return str.replace(/&quot;/gm, "\"")
			.replace(/&gt;/gm, ">")
			.replace(/&lt;/gm, "<")
			.replace(/&amp;/gm, "&");
	};

	$we.str.decodeHTML = function(str){
		return str.replace(/&nbsp;/g, " ")
			.replace(/&amp/g, "&")
			.replace(/&gt;/g, ">")
			.replace(/&lt;/g, "<")
			.replace(/&quot;/g, '"')
			.replace(/&#039;/g, "'");
	};
	
	$we.str.copy = function(str){
		return str;
	};
	
	$we.str.color = function(r, g, b){
		return "#" 
			+ (r <= 255 ? se.u.nToU(Math.floor(r), 2) : se.u.nToU(255, 2))
			+ (g <= 255 ? se.u.nToU(Math.floor(g), 2) : se.u.nToU(255, 2))
			+ (b <= 255 ? se.u.nToU(Math.floor(b), 2) : se.u.nToU(255, 2));
	};
	
	$we.str.toColor = function(color){
		color = color.replace("#", "");
		if(color.length == 3){
			color = [color.substring(0, 1), color.substring(0, 1),
				color.substring(1, 2), color.substring(0, 2),
				color.substring(2, 3), color.substring(0, 3)].join("");
		}
		if(color.length != 6){
			return {r : 0, g : 0, b : 0};
		}
		return {
			r : se.u.uToN(color.substring(0, 2)),
			g : se.u.uToN(color.substring(2, 4)),
			b : se.u.uToN(color.substring(4, 6))
		};
	};
	
	$we.str.formatDate = function (ms, format){
		var date = new Date();
		date.setFullYear(1970,1,1);
		date.setTime(0);
		date.setMilliseconds(ms);
		// return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
		// return (date.getMonth() + 1) + "-" + date.getDate();
		format = format || "M-d"; // y-M-d h:m:s
		var month = date.getMonth() + 1;
		return format.replace(/y/g, date.getFullYear())
			.replace(/M/g, (month>9?month:"0"+month))
			.replace(/d/g, (date.getDate()>9?date.getDate():"0"+date.getDate()))
			.replace(/h/g, (date.getHours()>9?date.getHours():"0"+date.getHours()))
			.replace(/m/g, (date.getMinutes()>9?date.getMinutes():"0"+date.getMinutes()))
			.replace(/s/g, (date.getSeconds()>9?date.getSeconds():"0"+date.getSeconds()));
	};
	
	$we.str.getUrlParam = function (url, name){
		var regexS = "[\\?&]" + name + "=([^&#]*)";
		var regex = new RegExp( regexS );
		var tmpURL = url;
		var results = regex.exec( tmpURL );
		if (results && results.length > 1){
			return decodeURIComponent(results[1].replace(/\+/g, " "));
		}
		return null;
	};
	
	$we.str.getPureUrl = function(url){
		url = url || window.location.href;
		return url.replace(/\?.*$/, "");
	};
	
	$we.str.delUrlParam = function (url, name){
		var regexS = "[\\?&]" + name + "=([^&#]*)";
		var regex = new RegExp( regexS );
		return url.replace(regex, "");
	};
	
	$we.str.replaceUrlParam = function(url, name, value, bIgnoreHash){
		var regexS = "([\\?&]" + name + "=)([^&#]*)";
		var regex = new RegExp( regexS );
		var bT = false;
		if(!bIgnoreHash){
			// ����Hash��
			var s = url.indexOf("#"),
				h = null;
			if(s != -1){
				h = url.substring(s);
				url = url.substring(0, s);
			}
		}
		url = url.replace(regex, function(a, b, c){
			bT = true;
			return b + encodeURIComponent("" + value);
		});
		if(!bT){
			if(url.indexOf("?") == -1){
				url += "?" + name + "=" + encodeURIComponent("" + value);
			}else{
				url += "&" + name + "=" + encodeURIComponent("" + value);
			}
		}
		if(h){
			url += h;
		}
		return url;
	};
	
	$we.str.replaceHTMLContent = function(str, keywords, cb, scope){
		if(keywords.indexOf("<") != -1 || keywords.indexOf(">") != -1){
			return str;
		}
		var reg;
		if(str.indexOf("<") != -1 || str.indexOf(">") != -1){
			// ����ĳ�ֱ�ǩ��
			str = str.replace(/\>([^<]+)|^([^<]+)/gi, function(a,b,c){
				var reg = new RegExp(keywords, "gi");
				if(a.indexOf(">") == 0){
					return ">" + ("" + b).replace(reg, function(a){
						return cb.call(scope, keywords);
					});
				}else{
					return ("" + b).replace(reg, function(a){
						return cb.call(scope, keywords);
					});
				}
			})
		}else{
			// ������ĳ�ֱ�ǩ��
			var reg = new RegExp("(" + keywords + ")", "gi");
			str = str.replace(reg, function(a,b,c){
				return cb.call(scope, keywords);
			});
		}
		return str;
	};
	
	var buildEchoTree = function(){
	};
	
	$we.str.analyzeTplEcho = function(str, source){
		var arr = str.replace(/^\{\$/, "").replace(/\}$/, "").split("|");
		var ret = {
			funcList : []
		};
		var source = source || {};
		if(arr.length == 0){
			return null;
		}
		var config = arr[0].match(/(\w+)\s*\[(.*?)\]|(\w+)/);
		if(!config){
			return null;
		}
		ret.echo = config[1] || config[3];
		if(config[2]){
			ret.config = eval("({" + config[2] + "})");
		}
		for(var i=1;i<arr.length;++i){
			var item = arr[i];
			if(item.indexOf("@") == 0 || item.indexOf("&") == 0){
				// ��ȫ�ֱ���ʹ�õ�
				item.replace(/^\@/, "");
				var s = item.replace(/^\@/, "").split("&"),
					c = s.shift().match(/^([\w\-]*)(\[.*\])$|^([\w\-]*)$|^(\[.*?\])$/) || [],
					value = decodeURIComponent(s.join("&")),
					file = c[1] || c[3] || "base",
					type = decodeURIComponent((c[2] || c[4] || "").replace(/^\[/, "").replace(/\]$/, ""));
				if(value){
					source[file] = source[file] || {};
					source[file][ret.echo] = {
						type : type,
						value : value
					};
				}
			}else{
				// ��������
				var func = item.match(/(\w+)\s*\((.*?)\)|(\w+)/);
				if(func){
					var funcConfig = {
						func : func[1] || func[3]
					};
					var p = (func[2] || "").replace(/^[\s\xa0\u3000]+|[\u3000\xa0\s]+$/g, "");
					if(p){
						param = p.split(",");
						for(var j=0;j<param.length;++j){
							param[j] = param[j].replace(/^[\s\xa0\u3000]+|[\u3000\xa0\s]+$/g, "");
							if(param[j].match(/\d+/)){
								param[j] = parseInt(param[j]);
							}else if(param == "true"){
								param[j] == true;
							}else if(param == "null"){
								param[j] = null;
							}else if(param == "false"){
								param[j] = false;
							}else{
								param[j] = decodeURIComponent(param[j].replace(/^[\"\']/, "").replace(/[\"\']$/, ""));
							}
						}
						funcConfig.param = param;
					}
					ret.funcList.push(funcConfig);
				}
			}
		}
		return ret;
	};
	
	$we.str.module = function(data, format){
		return format.replace(/\[([^\]\[]*?)\]/g, function(a, b, c){
			if(!b){
				return "[]";
			}
			if(b == "."){
				return data;
			}
			var ret = $we.json.get(data, b);
			if(!ret){
				return "[" + b + "]";
			}
			return ret;
		});
	};
	
	$we.str.calc = function(format, data, scope){
		var config = $we.str.analyzeTplEcho(format),
			ret = config.echo;
		ret = data[ret] || ret;
		for(var i=0;i<config.funcList.length;++i){
			funcList[i].param = funcList[i].param || [];
			funcList[i].param.funcList(ret);
			$we.str[config.funcList[i].func] 
				&& $we.str[config.funcList[i].func].apply(scope, funcList[i].param);
		}
		
	};
	
	var validateIdcard = function(idCard) {
		idCard = ('' + idCard).toLocaleUpperCase();

		var Errors = new Array(
			"",
			"身份证位数不对",
			"身份证出生日期超出范围",
			"身份证号不符合规范",
			"身份证地区非法",
			"不支持一代身份证"
		);

		var area = {
			11: "北京",
			12: "天津",
			13: "河北",
			14: "山西",
			15: "内蒙古",
			21: "辽宁",
			22: "吉林",
			23: "黑龙江",
			31: "上海",
			32: "江苏",
			33: "浙江",
			34: "安徽",
			35: "福建",
			36: "江西",
			37: "山东",
			41: "河南",
			42: "湖北",
			43: "湖南",
			44: "广东",
			45: "广西",
			46: "海南",
			50: "重庆",
			51: "四川",
			52: "贵州",
			53: "云南",
			54: "西藏",
			61: "陕西",
			62: "甘肃",
			63: "青海",
			64: "宁夏",
			65: "新疆",
			71: "台湾",
			81: "香港",
			82: "澳门",
			91: "国外"
		}

		var Y, JYM, S, M;
		var idcard_array = new Array();
		idcard_array = idCard.split('');

		//地区检验
		if (area[parseInt(idCard.substr(0, 2))] === null) {
			return Errors[4];
		}

		var ereg;
		//身份号码位数及格式检验
		switch (idCard.length) {
			case 15:
				return Errors[5];
				if ((parseInt(idCard.substr(6, 2)) + 1900) % 4 == 0 || ((parseInt(idCard.substr(6, 2)) + 1900) % 100 == 0 && (parseInt(idCard.substr(6, 2)) + 1900) % 4 == 0)) {
					ereg = /^[1-9][0-9]{5}[0-9]{2}((01|03|05|07|08|10|12)(0[1-9]|[1-2][0-9]|3[0-1])|(04|06|09|11)(0[1-9]|[1-2][0-9]|30)|02(0[1-9]|[1-2][0-9]))[0-9]{3}$/; //测试出生日期的合法性
				} else {
					ereg = /^[1-9][0-9]{5}[0-9]{2}((01|03|05|07|08|10|12)(0[1-9]|[1-2][0-9]|3[0-1])|(04|06|09|11)(0[1-9]|[1-2][0-9]|30)|02(0[1-9]|1[0-9]|2[0-8]))[0-9]{3}$/; //测试出生日期的合法性
				}
				if (ereg.test(idCard)) {
					return Errors[0];
				} else {
					return Errors[2];
				}
				break;
			case 18:
				ereg = /[0-9Xx]{1}/;
				if (!ereg.test(idCard.substr(idCard.length - 1))) {
					return Errors[3];
				}
				//18位身份号码检测
				//出生日期的合法性检查
				//闰年月日:((01|03|05|07|08|10|12)(0[1-9]|[1-2][0-9]|3[0-1])|(04|06|09|11)(0[1-9]|[1-2][0-9]|30)|02(0[1-9]|[1-2][0-9]))
				//平年月日:((01|03|05|07|08|10|12)(0[1-9]|[1-2][0-9]|3[0-1])|(04|06|09|11)(0[1-9]|[1-2][0-9]|30)|02(0[1-9]|1[0-9]|2[0-8]))
				if ( parseInt(idCard.substr(6,4)) % 4 == 0 || (parseInt(idCard.substr(6,4)) % 100 == 0 && parseInt(idCard.substr(6,4))%4 == 0 )){
					ereg=/^[1-9][0-9]{5}[1-2][0-9]{3}((01|03|05|07|08|10|12)(0[1-9]|[1-2][0-9]|3[0-1])|(04|06|09|11)(0[1-9]|[1-2][0-9]|30)|02(0[1-9]|[1-2][0-9]))[0-9]{3}[0-9X]$/;//闰年出生日期的合法性正则表达式
				} else {
					ereg=/^[1-9][0-9]{5}[1-2][0-9]{3}((01|03|05|07|08|10|12)(0[1-9]|[1-2][0-9]|3[0-1])|(04|06|09|11)(0[1-9]|[1-2][0-9]|30)|02(0[1-9]|1[0-9]|2[0-8]))[0-9]{3}[0-9X]$/;//平年出生日期的合法性正则表达式
				}
				if (ereg.test(idCard)) { //测试出生日期的合法性
					//计算校验位
					S = (parseInt(idcard_array[0]) + parseInt(idcard_array[10])) * 7 + (parseInt(idcard_array[1]) + parseInt(idcard_array[11])) * 9 + (parseInt(idcard_array[2]) + parseInt(idcard_array[12])) * 10 + (parseInt(idcard_array[3]) + parseInt(idcard_array[13])) * 5 + (parseInt(idcard_array[4]) + parseInt(idcard_array[14])) * 8 + (parseInt(idcard_array[5]) + parseInt(idcard_array[15])) * 4 + (parseInt(idcard_array[6]) + parseInt(idcard_array[16])) * 2 + parseInt(idcard_array[7]) * 1 + parseInt(idcard_array[8]) * 6 + parseInt(idcard_array[9]) * 3;
					Y = S % 11;
					M = "F";
					JYM = "10X98765432";
					M = JYM.substr(Y, 1); //判断校验位
					if (M == idcard_array[17]) {
						return Errors[0]; //检测ID的校验位
					} else {
						return Errors[3];
					}
				} else {
					return Errors[2];
				}
				break;
			default:
				return Errors[1];
				break;
		}
	};
	
	$we.str.checkValue = function(vv, opts, showError){
		opts = opts || {};
		if($we.type(opts) == $we.t.arr){
			var arr = opts;
			opts = {};
			for(var i=0;i<arr.length;++i){
				opts[arr[i].name] = arr[i].value;
			}
		}
		if(!showError){
			showError = function(str){
				alert(str);
			}
		}
		var notnull = opts["notnull"];
		if(notnull){
			if(!vv){
				showError.call(this, notnull);
				return false;
			}
		}
		var maxlen = opts["maxlen"];
		if(vv && maxlen && maxlen.match(/\d+/)){
			var len = parseInt(maxlen.match(/\d+/)[0]);
			if(vv.length > len){
				showError.call(this, maxlen);
				return false;
			}
		}
		var mustnum = opts["mustnum"];
		if(vv && mustnum){
			if(!vv.match(/^\d+(\.\d+)?$/)){
				showError.call(this, mustnum);
				return false;
			}
		}
		var mustIntNum = opts["mustIntNum"];
		if(vv && mustIntNum){
			if(!vv.match(/^\-?\d+?$/)){
				showError.call(this, mustIntNum);
				return false;
			}
		}
		var maxval = opts["maxval"];
		//maxval = $whale.val(maxval);
		if(vv && maxval && maxval.match(/\d+/)){
			var v = parseInt(maxval.match(/\d+/)[0]);
			if(parseFloat(vv) > v){
				showError.call(this, maxval.replace(/^\[\d+\]/, ""));
				return false;
			}
		}
		var minval = opts["minval"];
		//minval = $whale.val(minval);
		if(vv && minval && minval.match(/\d+/)){
			var v = parseInt(minval.match(/\d+/)[0]);
			if(parseFloat(vv) < v){
				showError.call(this, minval.replace(/^\[\d+\]/, ""));
				return false;
			}
		}
		var onlyw = opts["onlyw"];
		if(vv && onlyw){
			if(!vv.match(/^\w*$/)){
				showError.call(this, onlyw);
				return false;
			}
		}
		var musttel = opts["musttel"];
		if(vv && musttel){
			if(!vv.match(/^13|^14|^15|^17|^18/) || vv.length != 11 || !vv.match(/^\d+$/)){
				showError.call(this, musttel);
				return false;
			}
		}
		var isemail = opts["isemail"];
		if(vv && isemail){
			if(!vv.match(/^[a-z0-9]+([._\\-]*[a-z0-9])*@([a-z0-9]+[-a-z0-9]*[a-z0-9]+.){1,63}[a-z0-9]+$/i)){
				showError.call(this, isemail);
				return false;
			}
		}
		var isname = opts["isname"];
		if(vv && isname){
			// 支持中文和字母
			if(!vv.replace(/^\s+|\s+$/g, "").match(/^[a-zA-Z\u4E00-\u9FA5]+$/)){
				showError.call(this, isname);
				return false;
			}
		}
		var format = opts["format"];
		if(vv && format && format.match(/^\s*\{(.*)\}(\[i])?\s*(.*)$/)){
			// 支持中文和字母
			var m = format.match(/^\s*\{(.*)\}(\[i])?\s*(.*)$/),
				f = m[1] || "",
				i = m[2] || "",
				msg = m[3] || "";
			var regex = new RegExp( f, i );
			var results = vv.match(regex);
			if (!results){
				showError.call(this, msg);
				return false;
			}
		}
		var isdate = opts["isdate"];
		if(vv && isdate){
			// 为了兼容IE
			var vv1 = vv.replace(/\./g, "/")
				.replace(/\-/g, "/");
			var time = (new Date(vv1)).getTime();
			if(!(time>0)){
				// 不是一个正常的日期
				showError.call(this, isdate);
				return false;
			}
			var arr1 = $we.str.formatDate(time, "y-M-d").split("-"),
				arr2 = vv1.split("/");
			if(parseInt(arr1[0]) != parseInt(arr2[0]) || parseInt(arr1[1]) != parseInt(arr2[1]) || parseInt(arr1[2]) != parseInt(arr2[2])){
				showError.call(this, isdate);
				return false;
			}
		}
		var iscnname = opts["iscnname"];
		if(vv && iscnname){
			// 支持中文和字母
			if(!vv.replace(/^\s+|\s+$/g, "").match(/^[\u4E00-\u9FA5]+$/)){
				showError.call(this, iscnname);
				return false;
			}
		}
		var isidentitycard = opts["isidentitycard"];
		if(vv && isidentitycard){
			if(validateIdcard(vv)){
				showError.call(this, isidentitycard);
				return false;
			}
		}
	};
})($we);// 页面中可能需要的Popup
;(function(){
	var _maskHtml = [
		'<div attr="inner:mask" style="z-index:10001;width:100%;height:100%;left:0;top:0;background-color:#000000;position:fixed"></div>',
		'<div attr="inner:container" style="position: fixed; top: 0pt; left: 0pt; z-index: 10001; width: 100%;"></div>'
	].join("");
	
	var getClientHeight = function(){
		return (document.compatMode == "CSS1Compat")? document.documentElement.clientHeight : document.body.clientHeight;
	};
	
	var getClientWidth = function(){
		return (document.compatMode == "CSS1Compat")? document.documentElement.clientWidth : document.body.clientWidth; 
	};
	
	var getScrollTop = function(){
		return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
	};
	
	var getScrollWidth = function () {   
		return (document.compatMode == "CSS1Compat")? document.documentElement.scrollWidth : document.body.scrollWidth;  
	}

	
	// top, scroll, middle
	var init = function(el, opt){
		var me = this;
		this.config = opt || {};
		this.evtOnResize = function(e){
			evtOnResize(e, me);
		};
		this.appendHTML(_maskHtml, document.body);
		this.closeCb = opt.close || function(){};
		this.hideEl = [];
		this.el = el;
		if(!this.config.top){
			this.config.top = 0;
		}
		$(this.node.mask).css("opacity", 0.7);
		this.node.container.appendChild(this.el);
		$(this.el).css("position", "relative")
		$(this.el).css("margin", this.config.top + "px auto 0pt");
		close.call(this);
		if(typeof this.config.init == "function"){
			this.config.init.call(this.config.scope || window, el);
		}
		if(opt.zindex){
			$(this.node.mask).css("z-index", opt.zindex);
			$(this.node.container).css("z-index", opt.zindex);
		}
	};
	
	var getRoot = function(){
		return [this.node.mask, this.node.container]
	};
	
	var top = function(top){
		$(this.el).css("margin", top + "px auto 0pt");
		this.config.top = top;
		evtOnResize(null, this);
		return this;
	};
	
	var opacity = function(o){
		$(this.node.mask).css("opacity", o);
		return this;
	};
	
	var evtOnScroll = function(e, me){
		if(!me.config.preventScroll){
			return true;
		}
		try{
			e.preventDefault();
		}catch(e){}
		try{
			window.event.returnValue = false;
		}catch(e){}
		return false;
	};
	
	var evtOnResize = function(e, me){
		if(me.config.scroll){
			$(me.el).css("margin", "auto");
			$(me.node.container).css("position", "absolute");
			$(me.node.container).css("top", (me.config.top) + "px");
		}else if(me.config.middle){
			var h = getClientHeight();
			// alert(Math.floor((h - me.el.offsetHeight) / 2 + me.config.top));
			$(me.el).css("margin", Math.max(0, Math.floor((h - me.el.offsetHeight) / 2 + me.config.top)) + "px auto 0pt");
		}else{
			// TODO
		}
		if(false && $.browser.msie && $.browser.version=="6.0"){
			$(me.el).css("margin", "auto");
			if(!me.config.scroll){
				$(me.node.container).css("position", "absolute");
				$(me.node.container).css("top", (getScrollTop() + me.config.top) + "px");
			}
			_adjustMask(e, me);
		}
		if(typeof me.config.resize == "function"){
			me.config.resize.call(me.config.scope || window, {
				h : getClientHeight(),
				w : getClientWidth(),
				e : e
			});
		}
		
		// 计算一下容器宽度
		if(me.config.width){
			if(me.config.width > 0){
				$(me.node.container).width(me.config.width);
			}else{
				$(me.node.container).width(me.config.width + getClientWidth());
			}
		}
	};
	
	var _adjustMask = function(e, me){
		if(false && $.browser.msie && $.browser.version=="6.0"){
			$(me.node.mask).css("position", "absolute");
			$(me.node.mask).css("top", getScrollTop() + "px");
			$(me.node.mask).css("width", getScrollWidth());
			$(me.node.mask).css("height", getClientHeight() + "px");
		}
	};
	
	var show = function(e, me){
		//$(this.node.mask).show();
		//$(this.el).show();
		if(this.config.justHide){
			$(this.node.mask).show();
			$(this.node.container).show();
		}else{
			document.body.appendChild(this.node.mask);
			document.body.appendChild(this.node.container);
		}
		$(window).bind("mousewheel", this.evtOnResize);
		$(window).bind("resize", this.evtOnResize);
		$(window).bind("scroll", this.evtOnResize);
		evtOnResize(null, this);
	};
	
	var scroll = function(scroll){
		this.config.scroll = scroll;
		return this;
	};
	
	var setCloseCb = function(cb){
		this.closeCb = cb;
	};
	
	var close = function(){
		//$(this.node.mask).hide();
		//$(this.el).hide();
		if(this.config.justHide){
			$(this.node.mask).hide();
			$(this.node.container).hide();
		}else{
			if(this.node.mask.parentNode == document.body){
				document.body.removeChild(this.node.mask);
			}
			if(this.node.container.parentNode == document.body){
				document.body.removeChild(this.node.container);
			}
		}
		$(window).unbind("mousewheel", this.evtOnResize);
		$(window).unbind("resize", this.evtOnResize);
		$(window).unbind("scroll", this.evtOnResize);
		this.closeCb.call(this.config.scope);
		this.notify("close");
	};
	
	
	$we.widget.reg("we.ui.mask", {
		interfaces : {
			show : show,
			setCloseCb : setCloseCb,
			hide : close,
			top : top,
			opacity : opacity,
			scroll : scroll,
			getRoot : getRoot
		},
		init : init
	});
})();(function($we){
	// addChild
	// index
	// parent
	// {index, parent, children, }
	var init = function(data, id, opt, boss){
		var render = opt && opt.render || boss.config.render,
			father = opt && opt.father || boss.config.father;
		this.id = id;
		this.data = data;
		this.boss = boss;
		this.child = {};
		this.extend(father);
		var replace = render.call(this, data);
		this.appendHTML(opt && opt.itemHTML || boss.config.itemHTML, boss.parent, replace);
	};
	
	var remove = function(opt){
		this.notify("removeItem", this, opt);
	};
	
	var removeChild = function(item){
		for(var name in this.child){
			this.child[name] = $we.arr.remove(this.child[name], item.id);
		}
	};
	
	var scanWithDFS = function(cb, scope){
		for(var name in this.child){
			for(var i=0;this.child[name] && i < this.child[name].length;++i){
				var item = this.notify("getItemById", this.child[name][i]);
				if(cb.call(scope, item, this, name) === false){
					// 如果强行终止， 那么就不要继续深度下去
				}else{
					item.scanWithDFS(cb, scope);
				}
			}
		}
	};
	
	// category {name, el}
	// bAfter 默认是false
	var addChild = function(item, category, brother, bAfter, bRemoveBrother){
		this.notify("removeFirstChild", item.id);
		var parent = item.getParent.call();
		parent && parent.removeChild(item);
		if(!category){
			category = this.boss.config.category.call(this, item);
		}
		if(!this.child[category.name]){
			this.child[category.name] = [];
		}
		item.parent = this.id;
		if(brother){
			var id = brother.id,
				currIndex = 0,
				arr = $we.arr.remove(this.child[category.name], item.id);
			this.child[category.name] = [];
			while(arr.length){
				if(arr[0] == id){
					// 找到这样的节点， 就判断 bAfter
					if(bAfter){
						// 如果在这个后面， 再多一个
						this.child[category.name].push(arr.shift());
					}
					break;
				}
				this.child[category.name].push(arr.shift());
			}
			// 加进去
			this.child[category.name].push(item.id);
			// 需要处理一下brotherEl
			var siblling = this.notify("getItemById", arr[0]);
			var brotherEl = siblling && siblling.getContainer() || null;
			while(arr.length){
				this.child[category.name].push(arr.shift());
			}
			category.container.insertBefore(item.getContainer(), brotherEl);
		}else{
			this.child[category.name].push(item.id);
			category.container.appendChild(item.getContainer());
		}
		if(bRemoveBrother){
			this.notify("removeItem", brother);
		}
	};
	
	var delChild = function(item, category){
		if(!category){
			category = this.boss.config.category.call(this, item);
		}
		// var category = findCategory.call(this, item, opt);
		if(this.child[category.name]){
			//this.child[category.name] = this.child[category.name].splice($.inArray(item.id,this.child[category.name]),1); //se.arr.remove(this.child[category.name], item.id);
			this.child[category.name] = $we.arr.remove(this.child[category.name], item.id);
			var el = item.getContainer();
			if(category.container == el.parentNode){
				category.container.removeChild(el);
			}
		}
	};
	
	// struct, fetch
	var getValue = function(fetch){
		fetch = fetch || this.boss.config.fetch;
		var ret = {};
		for(var s in this.child){
			ret[s] = [];
			for(var i=0;i<this.child[s].length;++i){
				ret[s].push(this.notify("fetchValue", this.child[s][i], fetch));
			}
		}
		return fetch.call(this, ret);
	};
	
	var getContainer = function(){
		var findRoot = this.boss.config.root;
		var el = findRoot.call(this);
		return el;
	};
	
	var getValueByPath = function(path){
		return $we.json.get(this.data, path);
	};
	
	var getChildren = function(category){
		var els = this.child[category || "default"];
		return els && this.notify("fetchElements", els) || [];
	};
	
	var getParent = function(){
		return this.notify("getItemById", this.parent);
	};
	
	var moveUp = function(cbBefore, cbAfter, scope){
		var parent = getParent.call(this);
		if(parent){
			// 父亲节点存在的情况
			var child = parent.child;
			for(var category in child){
				if($we.arr.isIn(child[category], this.id)){
					var n2 = $we.arr.indexOf(child[category], this.id);
					if(n2 > 0){
						var n1 = n2 - 1;
						var obj1 = this.notify("getItemById", child[category][n1]);
						var obj2 = this;
						cbBefore && cbBefore.call(scope, obj1, obj2);
						parent.addChild(obj2, null, obj1);
						cbAfter && cbAfter.call(scope, obj1, obj2);
					}
					break;
				}
			}
		}else{
			// 父节点不存在的情况
			var child = this.notify("getFirstChild");
			if($we.arr.isIn(child, this.id)){
				var n2 = $we.arr.indexOf(child, this.id);
				if(n2 > 0){
					var n1 = n2 - 1;
					var obj1 = this.notify("getItemById", child[n1]);
					var obj2 = this;
					cbBefore && cbBefore.call(scope, obj1, obj2);
					el1 = obj1.getContainer();
					el2 = obj2.getContainer();
					if(el1.parentNode){
						el1.parentNode.insertBefore(el2, el1);
					}
					child = $we.arr.remove(child, obj1.id);
					var t = [];
					while(child.length && child[0] != obj1.id){
						t.push(child.shift());
					}
					t.push(obj1.id);
					while(child.length){
						t.push(child.shift());
					}
					this.notify("setFirstChild", t);
					cbAfter && cbAfter.call(scope, obj1, obj2);
				}
			}
		}
	};
	
	var moveDown = function(cbBefore, cbAfter, scope){
		var parent = getParent.call(this);
		if(parent){
			// 父亲节点存在的情况
			var child = parent.child;
			for(var category in child){
				if($we.arr.isIn(child[category], this.id)){
					var n1 = $we.arr.indexOf(child[category], this.id);
					if(n1 < child[category].length-1){
						var n2 = n1 + 1;
						var obj1 = this;
						var obj2 = this.notify("getItemById", child[category][n2]);
						cbBefore && cbBefore.call(scope, obj1, obj2);
						parent.addChild(obj2, null, obj1);
						cbAfter && cbAfter.call(scope, obj1, obj2);
					}
					break;
				}
			}
		}else{
			// 父节点不存在的情况
			var child = this.notify("getFirstChild");
			if($we.arr.isIn(child, this.id)){
				var n1 = $we.arr.indexOf(child, this.id);
				if(n1 < child.length-1){
					var n2 = n1 + 1;
					var obj1 = this;
					var obj2 = this.notify("getItemById", child[n2]);
					cbBefore && cbBefore.call(scope, obj1, obj2);
					el1 = obj1.getContainer();
					el2 = obj2.getContainer();
					if(el1.parentNode){
						el1.parentNode.insertBefore(el2, el1);
					}
					child = $we.arr.remove(child, obj1.id);
					var t = [];
					while(child.length && child[0] != obj1.id){
						t.push(child.shift());
					}
					t.push(obj1.id);
					while(child.length){
						t.push(child.shift());
					}
					this.notify("setFirstChild", t);
					cbAfter && cbAfter.call(scope, obj1, obj2);
				}
			}
		}
	};
	
	$we.widget.reg("we.ui.tree.item", {
		init : init,
		interfaces : {
			remove : remove,
			addChild : addChild,
			delChild : delChild,
			getValue : getValue,
			getChildren : getChildren,
			getContainer : getContainer,
			getValueByPath : getValueByPath,
			getParent : getParent,
			moveUp : moveUp,
			moveDown : moveDown,
			removeChild : removeChild,
			scanWithDFS : scanWithDFS
		}
	});
})($we);

(function($we){
	// getItemById
	// addValue
	// getValue
	var init = function(parent, opt){
		// UI RELATED
		this.parent = parent;
		opt = opt || {};
		opt.itemHTML = opt && opt.itemHTML || "";
		this.config = opt;
		// Some default setting
		opt.category = opt.category || function(){
			return {
				name : "default",
				container : this.node.container
			}
		};
		opt.root = opt.root || function(){
			return this.node.root;
		};
		// SELF DATA
		this.maxId = 0;
		this.list = {};
		this.child = [];
	};
	
	// SCAN each node
	var scan = function(fn){
		for(var name in this.list){
			fn.call(this.list[name], name);
		}
	};
	
	var scanWithDFS = function(cb, scope){
		for(var i=0;i<this.child.length;++i){
			var item = this.list[this.child[i]];
			if(cb.call(scope, item, null) === false){
				// 如果强行终止， 那么就不要继续深度下去
			}else{
				item.scanWithDFS(cb, scope);
			}
		}
	};
	
	var getValue = function(){
		return "";
	};
	
	var addValue = function(data, opt){
		// WHAT ONE ITEM NEEDED
		// 1. parentDiv
		var id = ++this.maxId;
		var ret = $we.widget.add({
			name : "we.ui.tree.item",
			notifyTo : this},
			data, id, opt, this);
		this.list[id] = ret;
		this.child.push(id);
		return ret;
	};
	
	var delValue = function(item){
	};
	
	var getItemById = function(id){
		return this.list[id];
	};
	
	var getDataById = function(id, fetch){
		return this.list[id].getValue(fetch);
	};
	
	var remove = function(item, opt){
		if(!item){
			return;
		}
		if(item.parent){
			this.list[item.parent].delChild(item, opt);
		}else{
			$we.dom.removeDomNode(item.getContainer());
		}
	};
	
	var fnSignal = function(){
		return this.notify("signal", this, arguments);
	};
	
	var fnRemoveItem = function(item, opt){
		remove.call(this, item, opt);
	};
	
	var fnFetchValue = function(id, fetch){
		return getDataById.call(this, id, fetch);
	};
	
	var fnFetchElements = function(ids){
		var ret = [];
		for(var i=0;i<ids.length;++i){
			ret.push(this.list[ids[i]]);
		}
		return ret;
	};
	
	var fnRemoveFirstChild = function(id){
		this.child = $we.arr.remove(this.child, id);
	};
	
	var fnGetFirstChild = function(){
		return this.child;
	};
	
	var fnSetFirstChild = function(t){
		this.child = t;
	};
	
	$we.widget.reg("we.ui.tree", {
		init : init,
		interfaces : {
			scan : scan,
			scanWithDFS : scanWithDFS,
			remove : remove,
			getValue : getValue,
			addValue : addValue,
			delValue : delValue,
			getItemById : getItemById,
			getDataById : getDataById
		},
		notifies : {
			signal : fnSignal,
			removeItem : fnRemoveItem,
			fetchValue : fnFetchValue,
			fetchElements : fnFetchElements,
			getItemById : getItemById,
			removeFirstChild : fnRemoveFirstChild,
			getFirstChild : fnGetFirstChild,
			setFirstChild : fnSetFirstChild
		}
	});
})($we);;(function(){
	var _init = function(parent, option){
		this.list = [];
		this.parent = parent;
		this.replace = null;
		this.bstop = false;
		this.mouseup = option && option.mouseup || function(){};
		this.replaceCb = option && option.replace || null;
		this.zIndex = option && option.zIndex || 0;
	};
	
	var _addItem = function(sender, container){
		var me = this;
		var fnMouseDown = function(e){
			if(me.bstop){												//如果已经停止了， 应该不能推动了
				return;
			}
			if(me.replaceCb){
				me.replace = me.replaceCb.call(me, container);
			}else{
				if(!me.replace){											// 创建替换的元素
					me.replace = document.createElement(container.tagName);
				}
				me.replace.className = container.className;
			}
			
		};
		var fnMouseMove = function(e){
			if(me.bstop){												//如果已经停止了， 应该不能推动了
				return;
			}
			if(!$we.dom.isParent(me.parent, me.replace)){
				me.parent.insertBefore(me.replace, container);
				$(container).addClass("move");
				return;
			}
			for(var i=0;i<me.list.length;++i){
				if(container == me.list[i]){
					continue;
				}
				if(container != me.list[i] && $we.event.isMouseIn(e, me.list[i])){
					me.parent.insertBefore(me.replace, me.list[i]);
					if($we.event.isMouseIn(e, me.list[i])){
						me.parent.insertBefore(me.list[i], me.replace);
					}
					return;
				}
			}
		};
		var fnMouseUp = function(e){
			if(me.bstop){												// 如果已经停止了， 应该不能推动了
				return;
			}
			if($we.dom.isParent(me.parent, me.replace)){
				me.parent.insertBefore(container, me.replace);
				$we.dom.removeDomNode(me.replace);
				$(container).removeClass("move");
				$(container).css("position", "static");
			}
			me.mouseup.call(container, e);
		};
		me.list.push(container);										// 添加新的元素进去便于拖动
		var drag = $we.event.makeDrag(
			sender,
			container,
			fnMouseDown,
			fnMouseMove,
			fnMouseUp
		);
		if(me.zIndex){
			drag.zIndex(me.zIndex);
		}
	};
		
	var _removeItem = function(){
		// 暂时不提供
	};
		
	var _stop = function(){
		this.bstop = true;
	};
		
	var _start = function(){
		this.bstop = false;
	};
	
	var _reset = function(){
		this.list = [];
	};

	$we.widget.reg("we.tool.sort", {
		interfaces : {
			"addItem" : _addItem,										// 添加一个元素进来参与拖拽
			"removeItem" : _removeItem,									// 移除一个需要拖拽的元素
			"stop" : _stop,												// 暂时不拖拽
			"start" : _start,											// 重置， 让他可以拖拽
			"reset" : _reset											// 清空原来的容器
		},
		init : _init
	});
})();
(function(){
	var init = function(parent, html, data){
		this.data = data;
		this.appendHTML(html, parent, data._replace);
		// 默认的选中的函数
		this._select = function(){
			$(this.node.root).css("backgroundColor", "#DEF5FF");
		};
		// 默认的非选中的函数
		this._unselect = function(){
			$(this.node.root).css("backgroundColor", "");
		};
	};
	
	// 该元素被选中后的操作
	var evtSelect = function(e, el){
		this.notify("itemSelect", this, el);
	};
	
	var evtCheck = function(e){
		this.notify("itemCheck", e, this);
	}
	
	// 将该元素置为选中状态的函数
	var select = function(){
		this._select.call(this);
	};
	
	// 将该元素置为非选中状态的函数
	var unselect = function(){
		this._unselect.call(this);
	};
	
	// 获取这个元素的根节点
	var getRoot = function(){
		return this.node.root;
	};
	
	// 获取这个元素对应的数据
	var getData = function(){
		return this.data;
	};
	
	// 将该元素直接从容器中移除
	var remove = function(){
		$(this.node.root).remove();
	};
	
	// 显示该元素
	var show = function(){
		$(this.node.root).show();
	};
	
	// 隐藏该元素
	var hide = function(){
		$(this.node.root).hide();
	};
	
	// 判断这个元素是否正在显示状态
	var isShowing = function(){
		if((""+this.node.root.style.display).toLowerCase() == "none"){
			return false;
		}
		return true;
	};
	
	// 设置选中的设置函数
	var setSelectCb = function(cb){
		if(typeof cb == "function"){
			this._select = cb;
		}else{
			this._select = function(){};
		}
		return this;
	};
	
	// 设置非选中的设置函数
	var setUnselectCb = function(cb){
		if(typeof cb == "function"){
			this._unselect = cb;
		}else{
			this._unselect = function(){};
		}
		return this;
	};

	$we.widget.reg("we.ui.list.item", {
		interfaces : {
			"getRoot" : getRoot,
			"select" : select,
			"remove" : remove,
			"unselect" : unselect,
			"getData" : getData,
			"show" : show,
			"hide" : hide,
			"isShowing" : isShowing,
			"setSelectCb" : setSelectCb,
			"setUnselectCb" : setUnselectCb
		},
		events : {
			"select" : evtSelect,
			"check" : evtCheck
		},
		init : init
	})
})();











(function(){
	var init = function(container){
		this.itemHTML = "";
		this.currentItem = null;
		this.data = {};
		this.sending = {};
		this.currentPage = null;
		this.container = container;
		this.selectMethod = function(){};
		this.readyMethod = function(){};
	};
	
	/*
	 * 每一个Item必须有自己的HTML， 通过这个函数可以设置子节点到底应该显示成什么样子
	 */
	var setItemHTML = function(html){
		this.itemHTML = html;
		return this;
	};
	
	/*
	 * 搜索的方法， 需要由外边提供
	 */
	var setSearchMethod = function(cb){
		this.searchMethod = cb;
		return this;
	};
	
	/*
	 * 当一个元素被取到后， 触发的函数
	 */
	var setSelectMethod = function(cb){
		this.selectMethod = cb;
		return this;
	};
	
	var setReadyMethod = function(cb){
		this.readyMethod = cb;
		return this;
	};
	
	var setSelectCb = function(cb){
		if(typeof cb == "function"){
			this.itemSelectCb = cb;
		}else{
			this.itemSelectCb = true;
		}
		return this;
	};
	
	var setUnselectCb = function(cb){
		if(typeof cb == "function"){
			this.itemUnselectCb = cb;
		}else{
			this.itemUnselectCb = true;
		}
		return this;
	};
	
	/*
	 * 每一个Item必须有自己的HTML， 通过这个函数可以设置子节点到底应该显示成什么样子
	 */
	var fnItemSelect = function(object, el){
		if(this.currentItem && this.currentItem != object){
			this.currentItem.unselect();
		}
		this.currentItem = object;
		object.select();
		data = object.getData();
		this.selectMethod(data, el, object);
		this.notify("itemSelect", data, el, object);
	};
	
	var fnItemCheck = function(e, item){
		this.notify("itemChecked", "emma.data.list", e, item, this)
	};
	
	var search = function(keyword){
		this.keyword = keyword;
		if(_reflushByCache.call(this)){
			return;
		}
		if(!_isSending.call(this, keyword)){
			return;
		}
		_requestNewPage.call(this);
	};
	
	var hide = function(){
		$(this.container).hide();
	};
	
	var show = function(){
		$(this.container).show();
	};
	
	// 选择当前页的上一条
	var up = function(){
		var n = _searchCurrentPage.call(this);
		if(n == -1){
			if(this.currentItem){
				this.currentItem.unselect();
			}
			this.currentItem = null;
			if(this.currentPage){
				this.currentItem = this.currentPage[this.currentPage.length - 1];
				this.currentItem.select();
			}
			return;
		}
		var nt = _searchNextPage.call(this, n, -1);
		if(nt != -1){
			this.currentItem.unselect();
			this.currentItem = this.currentPage[nt];
			this.currentItem.select();
			return;
		}
	};
	
	var unselect = function(){
		if(this.currentItem){
			this.currentItem.unselect();
			this.currentItem = null;
		}
	};
	
	var select = function(selFn){
		var empty = true;
		$.we.arr.each(this.currentPage, function(item){
			var data = item.getData();
			if(selFn(data)){
				item.select();
				empty = false;
			}else{
				item.unselect();
			}
		});
		return !empty;
	};
	
	// 根据查询条件， 找到合适的内容
	var find = function(fn){
		var ret = [];
		$we.arr.each(this.currentPage, function(item){
			var data = item.getData();
			if(fn(data, item)){
				ret.push(item);
			}
		});
		return ret;
	};
	
	// 选择当前页的下一条
	var down = function(bSelect){
		var n = _searchCurrentPage.call(this);
		if(n == -1){
			if(this.currentItem){
				this.currentItem.unselect();
			}
			this.currentItem = null;
			if(this.currentPage){
				this.currentItem = this.currentPage[0];
				this.currentItem.select();
			}
		}
		var nt = _searchNextPage.call(this, n, 1);
		if(nt != -1){
			this.currentItem.unselect();
			this.currentItem = this.currentPage[nt];
			this.currentItem.select();
			// 需要选择
			if(bSelect){
				data = this.currentItem.getData();
				this.selectMethod(data, null, this.currentItem);
			}
			return;
		}
	};
	
	var getCurrent = function(){
		return this.currentItem;
	};
	
	var filter = function(selFn){
		var empty = true;
		if(this.currentPage){
			$we.arr.each(this.currentPage, function(item){
				if(selFn(item)){
					item.show();
					empty = false;
				}else{
					item.hide();
				}
			});
		}
		if(empty){
			this.notify("showEmpty");
		}else{
			this.notify("hideEmpty");
		}
	};
	
	// 只添加一个
	var addOneMore = function(word, data){
		if(!this.data[word]){
			this.data[word] = [];
		}
		var tmp = $we.widget.add({
			name : "we.ui.list.item",
			notifyTo : this
		}, this.container,	this.itemHTML, data);
		if(this.itemSelectCb){
			tmp.setSelectCb(this.itemSelectCb);
		}
		if(this.itemUnselectCb){
			tmp.setUnselectCb(this.itemUnselectCb);
		}
		this.data[word].push(tmp);
		if(word == this.keyword){
			// 啥也不做
		}else{
			$we.dom.removeDomNode(tmp.getRoot());
		}
	};
	
	// 从Cache中读取， 如果能有数据， 那么就返回True， 否则， 返回False
	var _reflushByCache = function(){
		$we.dom.removeAllChilds(this.container);
		var word = this.keyword;
		if(this.data[word]){
			this.currentPage = arr = this.data[word];
			if(!arr.length){
				// 如果没有数据， 需要显示一个为空的界面
				this.notify("showEmpty");
			}else{
				// 如果有数据， 需要吧Loading和空界面都隐藏
				this.notify("hideEmpty");
				for(var i=0;i<arr.length;++i){
					arr[i].show();
					arr[i].unselect();
					this.container.appendChild(arr[i].getRoot());
				}
			}
			if(this.currentItem){
				this.currentItem.unselect();
			}
			this.currentItem = null;
			this.readyMethod();
			return true;
		}
		this.currentPage = null;
		return false;
	};
	
	// 这个函数是用来请求数据的， 当Keyword不存在的时候
	var _requestNewPage = function(){
		$we.dom.removeAllChilds(this.container);
		this.notify("hideEmpty");
		this.notify("showLoading");
		var word = this.keyword;
		var me = this;
		var cb = function(data){
			me.notify("hideLoading");
			_addDataToCache.call(me, word, data);
			_reflushByCache.call(me);
		};
		this.searchMethod(this.keyword, cb);
	};
	
	// 当有数据返回的时候， 我们需要把数据转换成为对象， 存到Cache中
	var _addDataToCache = function(word, data){
		this.data[word] = [];
		for(var i=0;i<data.length;++i){
			var tmp = $we.widget.add({
				name : "we.ui.list.item",
				notifyTo : this
			}, this.container,	this.itemHTML, data[i]);
			if(this.itemSelectCb){
				tmp.setSelectCb(this.itemSelectCb);
			}
			if(this.itemUnselectCb){
				tmp.setUnselectCb(this.itemUnselectCb);
			}
			this.data[word].push(tmp);
			$we.dom.removeDomNode(tmp.getRoot());
		}
	};
	
	var _isSending = function(word){
		if(this.sending[word]){
			this.sending[word] = true;
			return false;
		}
		return true;
	};
	
	var _searchCurrentPage = function(){
		if(!this.currentPage || !this.currentItem){
			return -1;
		}
		for(var i=0;i<this.currentPage.length;++i){
			if(this.currentItem == this.currentPage[i]){
				return i;
			}
		}
		return -1;
	};
	
	var _searchNextPage = function(n, step){
		if(!step){
			return;
		}
		n += step;
		while( n >=0 && n < this.currentPage.length){
			if(this.currentPage[n].isShowing()){
				return n;
			}
			n += step;
		}
		return -1;
	};
	
	$we.widget.reg("we.ui.list", {
		interfaces : {
			setItemHTML : setItemHTML,
			setSearchMethod : setSearchMethod,
			setSelectMethod : setSelectMethod,
			setReadyMethod : setReadyMethod,
			setSelectCb : setSelectCb,
			setUnselectCb : setUnselectCb,
			hide : hide,
			show : show,
			find : find,
			search : search,
			up : up,
			down : down,
			getCurrent : getCurrent,
			filter : filter,
			unselect : unselect,
			select : select,
			addOneMore : addOneMore
		},
		notifies : {
			"itemSelect" : fnItemSelect,
			"itemCheck" : fnItemCheck
		},
		init : init
	});
})();