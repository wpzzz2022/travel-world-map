export interface Photo {
  /** 图片地址：http(s) 链接、站点内路径（/xhs/xxx.jpg）、data:URL 或本机文件夹的 blob:URL */
  url: string;
  caption?: string;
  /** 视频标记（blob: 地址没有扩展名，需要显式标出；普通地址可按扩展名自动识别） */
  video?: boolean;
}

export interface XhsPost {
  id: string;
  url: string;
  title?: string;
  author?: string;
  /** 笔记里保存下来的图片（可从 public/xhs/ 引用） */
  images: Photo[];
  note?: string;
}

export interface CheckinPoint {
  id: string;
  name: string;
  description?: string;
  /** [经度, 纬度] */
  coords?: [number, number];
  photos: Photo[];
}

export interface Spot {
  id: string;
  name: string;
  description?: string;
  coords?: [number, number];
  checkins: CheckinPoint[];
  posts: XhsPost[];
  photos: Photo[];
  /** 关联的本机相册文件夹名（句柄存在 IndexedDB，见 MediaFolder 组件） */
  folderName?: string;
}

export type DestStatus = "dream" | "visited";

export interface Destination {
  id: string;
  name: string;
  status: DestStatus;
  summary?: string;
  coords?: [number, number];
  spots: Spot[];
}

export interface CountryEntry {
  destinations: Destination[];
}

/** 行程里的一段：目的地（可关联已有城市/目的地）或自由填写的一站 */
export interface TripLeg {
  id: string;
  /** 展示名，通常 = 目的地名 */
  title: string;
  /** 关联的目的地（可选）：国家代码 + destId */
  country?: string;
  destId?: string;
  /** 这一站计划待几天 */
  days: number;
  note?: string;
}

export type TripStatus = "planning" | "done";

/** 一份待出行的旅行计划：把想去的城市按顺序串起来 */
export interface Trip {
  id: string;
  title: string;
  status: TripStatus;
  legs: TripLeg[];
  note?: string;
  createdAt: string;
}

export interface TravelData {
  version: 1;
  countries: Record<string, CountryEntry>;
  trips?: Trip[];
  /** 冒险记录：一次到访（去过的地方）= 日期 + 地点 + 相册 + 感想 */
  adventures?: Adventure[];
}

/** 仿 AdventureLog 的冒险记录：记录一次"去过" */
export interface Adventure {
  id: string;
  title: string;
  /** 关联的目的地（可选）：国家代码 + destId */
  country?: string;
  destId?: string;
  /** 到访日期（yyyy-mm-dd），结束日期可选（多天行程） */
  dateStart?: string;
  dateEnd?: string;
  /** 1-5 星，可选 */
  rating?: number;
  note?: string;
  /** 关联的本机相册文件夹名（句柄存 IndexedDB） */
  folderName?: string;
  /** 手动添加的图片（小图 base64 / 链接），本机文件夹相册单独浏览 */
  photos: Photo[];
}
